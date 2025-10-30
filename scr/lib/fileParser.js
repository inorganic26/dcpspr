import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// PDF.js 워커 설정 (Vite는 pdf.worker.min.mjs를 사용)
// ⭐️ 이 코드는 fileParser.js로 이동되었습니다.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// --- 파일 파싱 함수들 ---

/**
 * 파일 이름에서 '클래스명'과 '날짜'를 기준으로 PDF와 스프레드시트 파일을 짝지어 반환합니다.
 * @param {File[]} files - 사용자가 업로드한 파일 배열
 * @returns {Object} { "클래스명_날짜": { pdf: File, spreadsheet: File } }
 */
export function pairFiles(files) {
    const fileGroups = {};
    const regex = /(.+?)\s*(\d+월\s*\d+일)/; // "클래스명 날짜" 형식 매칭

    files.forEach(file => {
        const match = file.name.match(regex);
        if (match) {
            const className = match[1].trim();
            const date = match[2].trim().replace(/\s/g, ''); // "8월 15일" -> "8월15일"
            const key = `${className}_${date}`;
            
            if (!fileGroups[key]) fileGroups[key] = {};
            
            const extension = file.name.split('.').pop().toLowerCase();
            if (['csv', 'xlsx'].includes(extension)) {
                fileGroups[key].spreadsheet = file;
            } else if (extension === 'pdf') {
                fileGroups[key].pdf = file;
            }
        }
    });

    const finalPairedFiles = {};
    for (const key in fileGroups) {
        // PDF와 스프레드시트가 모두 있는 쌍만 반환
        if (fileGroups[key].spreadsheet && fileGroups[key].pdf) {
            finalPairedFiles[key] = fileGroups[key];
        }
    }
    return finalPairedFiles;
}

/**
 * CSV 파일을 파싱하여 JSON 객체 배열로 반환합니다.
 * @param {File} file - CSV 파일
 * @returns {Promise<Object[]>}
 */
export function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: header => header.trim(),
            complete: (results) => {
                if (results.errors.length > 0 && results.data.length === 0) {
                    reject(new Error(`CSV 파싱 오류: ${results.errors[0].message}`));
                } else {
                    resolve(results.data);
                }
            }
        });
    });
}

/**
 * XLSX (Excel) 파일을 파싱하여 JSON 객체 배열로 반환합니다.
 * @param {File} file - XLSX 파일
 * @returns {Promise<Object[]>}
 */
export function parseXLSX(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(new Error("XLSX 파일 읽기 오류"));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * PDF 파일의 모든 텍스트를 추출하여 하나의 문자열로 반환합니다.
 * @param {File} file - PDF 파일
 * @returns {Promise<string>}
 */
export async function parsePDF(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
            try {
                const loadingTask = pdfjsLib.getDocument(event.target.result);
                const pdf = await loadingTask.promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ');
                }
                resolve(fullText);
            } catch (error) {
                console.error("PDF Parsing Error:", error);
                reject(error);
            }
        };
        reader.onerror = (error) => {
            console.error("File Reader Error:", error);
            reject(error);
        };
        reader.readAsArrayBuffer(file);
    });
}

/**
 * 파싱된 스프레드시트 데이터를 학생별 점수, 정답률, 반 평균 등으로 처리합니다.
 * @param {Object[]} spreadsheetData - parseCSV 또는 parseXLSX의 결과
 * @returns {Object}
 */
export function processStudentData(spreadsheetData) {
    if (!spreadsheetData || spreadsheetData.length === 0) {
        return { students: [], classAverage: 0, answerRates: [], questionCount: 0 };
    }

    const headers = Object.keys(spreadsheetData[0]);
    const studentHeader = headers.find(h => h.includes('학생'));
    const scoreHeader = headers.find(h => h.includes('점수'));

    if (!studentHeader || !scoreHeader) {
        throw new Error("CSV/XLSX 파일에서 '학생' 또는 '점수' 열을 찾을 수 없습니다.");
    }

    const allStudents = [];
    let questionCount = headers.filter(h => !isNaN(parseInt(h))).length;
    
    const studentRows = spreadsheetData.filter(row => row[studentHeader] && row[studentHeader] !== '평균점수/문항정답률');

    studentRows.forEach(row => {
        const student = { name: row[studentHeader], answers: [] };
        let isSubmitted = false;
        for (let i = 1; i <= questionCount; i++) {
            const answer = row[i] ? String(row[i]).trim().toUpperCase() : '';
            if (answer === 'O' || answer === 'X') {
                isSubmitted = true;
            }
            student.answers.push({ qNum: i, isCorrect: answer === 'O' });
        }

        if (isSubmitted) {
            student.submitted = true;
            student.score = parseInt(row[scoreHeader]) || 0;
        } else {
            student.submitted = false;
            student.score = '미응시';
        }
        allStudents.push(student);
    });
    
    const submittedStudents = allStudents.filter(s => s.submitted);
    const submittedCount = submittedStudents.length;
    let classAverage = 0;
    if (submittedCount > 0) {
        const totalScore = submittedStudents.reduce((sum, s) => sum + s.score, 0);
        classAverage = Math.round(totalScore / submittedCount);
    }

    const answerRates = [];
    for (let i = 0; i < questionCount; i++) {
        if (submittedCount > 0) {
            const correctCount = submittedStudents.filter(s => s.answers[i].isCorrect).length;
            answerRates.push(Math.round((correctCount / submittedCount) * 100));
        } else {
            answerRates.push(0);
        }
    }

    return { students: allStudents, classAverage, answerRates, questionCount };
}