import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * ⭐️ [수정됨]
 * 파일 이름에서 '날짜' 부분을 제거하고 '클래스명(반 이름)'을 기준으로 파일을 짝짓습니다.
 * @param {File[]} files - 사용자가 업로드한 파일 배열
 * @returns {Object} { "클래스명": { pdf: File, spreadsheet: File } }
 */
export function pairFiles(files) {
    const fileGroups = {};
    // 1. " 10월 30일" 또는 "_10월30일" 같은 날짜 형식을 찾습니다.
    const dateRegex = /[\s_]*(\d+월\s*\d+일)[\s_]*/;

    files.forEach(file => {
        const extension = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'csv', 'xlsx'].includes(extension)) return;

        // 2. 파일 이름에서 날짜 부분과 확장자를 제거하여 "클래스명"을 key로 사용
        const key = file.name.replace(dateRegex, ' ') // 날짜 부분을 공백으로 (혹시 중간에 껴있을까봐)
                           .replace(/\.(pdf|csv|xlsx)$/i, '') // 확장자 제거
                           .trim(); // 양쪽 공백 제거

        if (!key) return; // 이름이 없으면 무시

        if (!fileGroups[key]) fileGroups[key] = {};
        
        if (['csv', 'xlsx'].includes(extension)) {
            fileGroups[key].spreadsheet = file;
        } else if (extension === 'pdf') {
            fileGroups[key].pdf = file;
        }
    });

    const finalPairedFiles = {};
    for (const key in fileGroups) {
        // 3. PDF와 스프레드시트가 모두 있는 쌍만 반환
        if (fileGroups[key].spreadsheet && fileGroups[key].pdf) {
            finalPairedFiles[key] = fileGroups[key];
        }
    }
    // 4. 이제 반환값은 { "고1A반": { pdf: ..., spreadsheet: ... } } 형태가 됩니다.
    return finalPairedFiles;
}

// ... (parseCSV, parseXLSX, parsePDF, processStudentData 함수는 기존과 동일) ...

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