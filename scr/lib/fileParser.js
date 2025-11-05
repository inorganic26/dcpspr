// scr/lib/fileParser.js

// ⭐️ ESM 방식(방법 ①)으로 라이브러리 임포트 (이전과 동일)
import * as pdfjsLib from 'pdfjs-dist';
// ⭐️ Vite의 ?url 기능을 사용하여 워커 스크립트 경로 지정 (이전과 동일)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; 
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ⭐️ 워커 설정 (이전과 동일)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * PDF 파일에서 텍스트를 추출합니다. (이전과 동일)
 */
export const parsePDF = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data }).promise; 
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                resolve(fullText);
            } catch (error) {
                console.error("PDF Parsing Error:", error); 
                reject(error);
            }
        };
        reader.onerror = (error) => {
            console.error("File Reading Error:", error);
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
};

/**
 * CSV 파일에서 데이터를 파싱합니다. (이전과 동일)
 */
export const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    reject(new Error("CSV 파싱 오류: " + results.errors[0].message));
                } else {
                    resolve(results.data);
                }
            },
            error: (error) => {
                reject(error);
            }
        });
    });
};

/**
 * XLSX (Excel) 파일에서 데이터를 파싱합니다. (이전과 동일)
 */
export const parseXLSX = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                const headers = jsonData[0];
                const dataRows = jsonData.slice(1).map(row => {
                    let obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index];
                    });
                    return obj;
                });
                resolve(dataRows);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
};


/**
 * 파일 이름에서 반 이름을 추출합니다. (이전과 동일)
 */
function getClassNameFromFile(fileName) {
    const baseName = fileName.split('.')[0]; 
    const keywordsToRemove = ['정오표', '시험지', '성적표', '데이터'];
    let className = baseName;
    for (const keyword of keywordsToRemove) {
        if (className.includes(keyword)) {
            className = className.split(keyword)[0].trim();
            break; 
        }
    }
    
    if (className.trim().length === 0) {
        className = baseName; 
    }

    return className.trim();
}

/**
 * 업로드된 파일들을 반 이름 기준으로 페어링합니다. (이전과 동일)
 */
export function pairFiles(files) {
    const fileMap = {}; 

    files.forEach(file => {
        const className = getClassNameFromFile(file.name);
        if (!className) return;

        if (!fileMap[className]) {
            fileMap[className] = {};
        }

        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'pdf') {
            fileMap[className].pdf = file;
        } else if (extension === 'csv' || extension === 'xlsx') {
            fileMap[className].spreadsheet = file;
        }
    });

    const paired = {};
    Object.keys(fileMap).forEach(className => {
        if (fileMap[className].pdf && fileMap[className].spreadsheet) {
            paired[className] = fileMap[className];
        }
    });

    return paired;
}


/**
 * ⭐️ [수정] 파싱된 성적표 데이터를 표준화된 학생 데이터로 처리합니다. (헤더 검색 로직 강화)
 */
export function processStudentData(spreadsheetData) {
    if (!spreadsheetData || spreadsheetData.length === 0) {
        throw new Error("성적표 데이터가 비어있습니다.");
    }

    // 1. 헤더에서 '이름'과 '총점' 열 찾기 (⭐️ 유연성 강화)
    const headers = Object.keys(spreadsheetData[0]);

    // ⭐️ [수정] 이름 헤더를 찾는 키워드 목록
    const nameKeywords = ['이름', '학생명', '성명', '학생','name'];
    // ⭐️ [수정] 점수 헤더를 찾는 키워드 목록
    const scoreKeywords = ['총점', '점수', 'score'];

    // ⭐️ [수정] 헤더를 찾는 헬퍼 함수
    const findHeader = (keywords) => {
        const lowerCaseKeywords = keywords.map(k => k.toLowerCase());
        // 1. 정확히 일치하는 헤더 찾기 (예: '이름')
        let header = headers.find(h => lowerCaseKeywords.includes(h.toLowerCase().trim()));
        if (header) return header;
        
        // 2. 포함된 헤더 찾기 (예: '학생 이름')
        header = headers.find(h => {
            const lowerH = h.toLowerCase().trim();
            return lowerCaseKeywords.some(k => lowerH.includes(k));
        });
        return header;
    };
    
    const nameHeader = findHeader(nameKeywords);
    const scoreHeader = findHeader(scoreKeywords);
    
    // ⭐️ [수정] 오류 메시지 개선
    if (!nameHeader) throw new Error("엑셀/CSV 파일에서 '이름' 또는 '학생명' 열을 찾을 수 없습니다.");
    if (!scoreHeader) throw new Error("엑셀/CSV 파일에서 '총점' 또는 '점수' 열을 찾을 수 없습니다.");

    // 2. 문항 번호(숫자 헤더) 열 찾기 (이전과 동일)
    const questionHeaders = headers.filter(h => /^\d+$/.test(h.trim()));
    if (questionHeaders.length === 0) {
        throw new Error("문항 번호(숫자) 열을 찾을 수 없습니다.");
    }
    const questionCount = questionHeaders.length;
    
    // 3. 학생 데이터 추출 (이전과 동일)
    let totalScore = 0;
    const students = [];
    const questionCorrectCounts = Array(questionCount).fill(0); 

    spreadsheetData.forEach((row, rowIndex) => {
        const name = row[nameHeader]?.trim();
        const scoreStr = row[scoreHeader];
        
        if (!name || name.includes('평균') || name.includes('정답률')) {
            return;
        }

        const score = parseFloat(scoreStr);
        if (isNaN(score)) {
             console.warn(`'${name}' 학생의 점수(${scoreStr})가 유효하지 않아 제외합니다.`);
             return;
        }

        const answers = [];
        let correctCount = 0;
        
        questionHeaders.forEach((qHeader, index) => {
            const answerValue = row[qHeader]; 
            const isCorrect = answerValue === 'O' || answerValue === 1 || String(answerValue).toLowerCase() === 'o';
            
            answers.push({
                qNum: parseInt(qHeader, 10),
                answer: String(answerValue),
                isCorrect: isCorrect
            });

            if (isCorrect) {
                correctCount++;
                questionCorrectCounts[index]++;
            }
        });

        students.push({
            id: `student-${rowIndex}`,
            name: name,
            score: score,
            answers: answers,
            correctCount: correctCount,
            submitted: true, 
            aiAnalysis: null 
        });
        
        totalScore += score;
    });

    if (students.length === 0) {
        throw new Error("유효한 학생 데이터를 찾을 수 없습니다. '이름'과 '총점' 열을 확인하세요.");
    }

    // 4. 통계 계산 (이전과 동일)
    const classAverage = (totalScore / students.length).toFixed(1);
    const answerRates = questionCorrectCounts.map(count => 
        parseFloat(((count / students.length) * 100).toFixed(1))
    );

    return {
        students: students,
        studentCount: students.length,
        classAverage: classAverage,
        questionCount: questionCount,
        answerRates: answerRates,
        questionHeaders: questionHeaders 
    };
}