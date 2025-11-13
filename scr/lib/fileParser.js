// scr/lib/fileParser.js

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; 
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * PDF 파일에서 텍스트를 추출합니다.
 * (gemini-2.5-flash가 '반 전체 총평' 분석 시 사용)
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
                console.error("PDF 텍스트 파싱 실패:", error);
                reject(new Error("PDF 텍스트를 읽는 데 실패했습니다."));
            }
        };
        reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
        reader.readAsArrayBuffer(file);
    });
};

/**
 * ⭐️ [신규] PDF 파일을 페이지별 이미지(Base64) 배열로 변환합니다.
 * (gemini-1.5-pro가 '유형/난이도' 분석 시 사용)
 */
export const convertPdfToImages = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data }).promise;
                const imagePromises = [];
                const scale = 1.5; // (해상도. 필요시 조절)

                for (let i = 1; i <= pdf.numPages; i++) {
                    imagePromises.push(
                        pdf.getPage(i).then(async (page) => {
                            const viewport = page.getViewport({ scale });
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                            
                            // ⭐️ Base64 데이터 추출 (MIME 타입 헤더 제거)
                            return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
                        })
                    );
                }
                
                const images = await Promise.all(imagePromises);
                console.log(`PDF를 ${images.length}장의 이미지로 변환 완료.`);
                resolve(images); // ⭐️ [img1_base64, img2_base64, ...]

            } catch (error) {
                console.error("PDF 이미지 변환 실패:", error);
                reject(new Error("PDF를 이미지로 변환하는 데 실패했습니다."));
            }
        };
        reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
        reader.readAsArrayBuffer(file);
    });
};


/**
 * CSV 파일에서 데이터를 파싱합니다. (기존 함수 - 변경 없음)
 */
export const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length) {
                    reject(new Error("CSV 파싱 오류: " + results.errors[0].message));
                } else {
                    resolve(results.data);
                }
            },
            error: (error) => reject(new Error("CSV 파일 읽기 실패: " + error.message))
        });
    });
};

/**
 * XLSX (엑셀) 파일에서 데이터를 파싱합니다. (기존 함수 - 변경 없음)
 */
export const parseXLSX = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length < 2) {
                    reject(new Error("엑셀 시트가 비어있거나 헤더만 존재합니다."));
                    return;
                }
                
                const headers = jsonData[0];
                const dataRows = jsonData.slice(1);
                
                const formattedData = dataRows.map(row => {
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = row[index];
                    });
                    return rowData;
                });
                
                resolve(formattedData);
            } catch (error) {
                console.error("XLSX 파싱 실패:", error);
                reject(new Error("XLSX 파일 파싱 중 오류가 발생했습니다."));
            }
        };
        reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
        reader.readAsArrayBuffer(file);
    });
};


/**
 * 파일 이름에서 반 이름을 추출합니다.
 */
const getClassNameFromFile = (fileName) => {
    const baseName = fileName.replace(/\.(pdf|csv|xlsx)$/i, '');
    // ⭐️ [수정] '정오표' 키워드도 제거하도록 추가
    return baseName.replace(/시험지|성적표|성적|정오표/g, '').trim(); 
};

/**
 * 파일들을 반 이름 기준으로 짝짓습니다. (기존 함수 - 변경 없음)
 */
export const pairFiles = (files) => {
    const pairs = {};
    files.forEach(file => {
        const className = getClassNameFromFile(file.name);
        if (!pairs[className]) {
            pairs[className] = {};
        }
        if (file.name.endsWith('.pdf')) {
            pairs[className].pdf = file;
        } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
            pairs[className].spreadsheet = file;
        }
    });
    
    // PDF와 성적표가 모두 있는 쌍만 반환
    return Object.keys(pairs).reduce((acc, key) => {
        if (pairs[key].pdf && pairs[key].spreadsheet) {
            acc[key] = pairs[key];
        }
        return acc;
    }, {});
};


/**
 * ⭐️ [수정] 파싱된 학생 데이터를 표준 형식으로 처리합니다.
 */
export const processStudentData = (data) => {
    if (!data || data.length === 0) {
        throw new Error("학생 데이터가 비어있습니다.");
    }
    
    const headers = Object.keys(data[0]);
    
    // ⭐️ [수정] '학생' 키워드 추가 (CSV 파일 호환)
    const nameHeader = headers.find(h => ['이름', 'name', 'student', '학생'].includes(h.toLowerCase()));
    // ⭐️ [수정] '점수\문제' 키워드 추가 (CSV 파일 호환)
    const scoreHeader = headers.find(h => ['총점', '점수', 'score', 'total', '점수\\문제'].includes(h.toLowerCase()));
    
    if (!nameHeader || !scoreHeader) {
        throw new Error("엑셀/입력 데이터에서 '이름' 또는 '총점' 열을 찾을 수 없습니다.");
    }

    const questionHeaders = headers.filter(h => !isNaN(parseInt(h, 10)));
    const questionCount = questionHeaders.length;
    
    if (questionCount === 0) {
        throw new Error("엑셀/입력 데이터에서 '1', '2', '3'과 같은 문항 번호 열을 찾을 수 없습니다.");
    }
    
    const students = [];
    let totalScore = 0;
    const questionCorrectCounts = Array(questionCount).fill(0);

    data.forEach((row, rowIndex) => {
        const name = row[nameHeader];
        // ⭐️ [수정] '점수' 열에 "65점"처럼 텍스트가 포함된 경우 숫자만 추출
        const score = parseFloat(String(row[scoreHeader]).replace(/[^0-9.]/g, ''));
        
        if (!name || isNaN(score)) return; // ⭐️ 이름이 없거나 점수가 NaN이면 건너뛰기

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
            // ⭐️ [수정] 'id' 필드 제거 (DB에서 'name'을 ID로 사용)
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

    const classAverage = (totalScore / students.length).toFixed(1);
    const answerRates = questionCorrectCounts.map(count => 
        parseFloat(((count / students.length) * 100).toFixed(1))
    );

    return {
        students: students,
        studentCount: students.length,
        classAverage: classAverage,
        questionCount: questionCount,
        answerRates: answerRates
    };
};