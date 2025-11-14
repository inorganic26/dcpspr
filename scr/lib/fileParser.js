// scr/lib/fileParser.js

import { getDocument } from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.min.mjs'; // ⭐️ [수정] 워커 명시적 임포트 (Vite 호환성)
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// -------------------------------------------------------------------
// 1. PDF 파싱 (Text)
// -------------------------------------------------------------------
export const parsePDF = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const pdf = await getDocument({ data }).promise;
                let fullText = "";

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += `--- PAGE ${i} ---\n\n${pageText}\n\n`;
                }
                resolve(fullText);
            } catch (error) {
                console.error("PDF 텍스트 파싱 실패:", error);
                reject(new Error("PDF 텍스트 파싱에 실패했습니다."));
            }
        };
        reader.onerror = (e) => reject(new Error("PDF 파일 읽기 실패: " + e.target.error.message));
        reader.readAsArrayBuffer(file);
    });
};


// -------------------------------------------------------------------
// 2. PDF 파싱 (Image)
// -------------------------------------------------------------------
const PDF_TO_IMAGE_DPI = 200; // ⭐️ DPI (해상도)

export const convertPdfToImages = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const pdf = await getDocument({ data }).promise;
                const imagePromises = [];
                const scale = PDF_TO_IMAGE_DPI / 72; // 72 DPI (기본)

                for (let i = 1; i <= pdf.numPages; i++) {
                    imagePromises.push(
                        pdf.getPage(i).then(page => {
                            const viewport = page.getViewport({ scale });
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            return page.render({ canvasContext: context, viewport }).promise.then(() => {
                                // ⭐️ Base64 JPEG로 변환 (품질 0.8)
                                return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; 
                            });
                        })
                    );
                }
                
                const base64Images = await Promise.all(imagePromises);
                console.log(`PDF를 ${base64Images.length}장의 이미지로 변환 완료.`);
                resolve(base64Images);

            } catch (error) {
                console.error("PDF 이미지 변환 실패:", error);
                reject(new Error("PDF를 이미지로 변환하는 데 실패했습니다."));
            }
        };
        reader.onerror = (e) => reject(new Error("PDF 파일 읽기 실패: " + e.target.error.message));
        reader.readAsArrayBuffer(file);
    });
};


// -------------------------------------------------------------------
// 3. 엑셀/CSV 파싱
// -------------------------------------------------------------------
export const parseXLSX = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1, // ⭐️ 헤더를 배열로 취급
                    defval: ""  // ⭐️ 빈 셀은 빈 문자열로
                });
                
                // ⭐️ 첫 번째 행(헤더)과 나머지 행(데이터)을 분리
                const header = json[0];
                const rows = json.slice(1);

                // ⭐️ 헤더를 키로 하는 JSON 객체 배열로 재조립
                const formattedJson = rows.map(row => {
                    const obj = {};
                    header.forEach((key, index) => {
                        obj[key] = row[index];
                    });
                    return obj;
                });
                
                resolve(formattedJson);
            } catch (error) {
                reject(new Error("XLSX 파일 파싱 실패: " + error.message));
            }
        };
        reader.onerror = (e) => reject(new Error("XLSX 파일 읽기 실패: " + e.target.error.message));
        reader.readAsArrayBuffer(file);
    });
};

export const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(new Error("CSV 파일 파싱 실패: " + error.message))
        });
    });
};


// -------------------------------------------------------------------
// 4. 학생 데이터 처리 및 통계 계산
// -------------------------------------------------------------------
export const processStudentData = (rawData) => {
    const students = [];
    let totalScore = 0;
    let questionCount = 0;
    let answerRates = [];

    if (!rawData || rawData.length === 0) {
        throw new Error("학생 데이터가 비어있습니다. (rawData)");
    }

    // 1. 문항 수(questionCount) 결정 (첫 번째 학생 기준)
    const firstRow = rawData[0];
    const keys = Object.keys(firstRow);
    const questionKeys = keys.filter(k => !isNaN(parseInt(k, 10)) && parseInt(k, 10) > 0);
    questionCount = questionKeys.length;

    if (questionCount === 0) {
        throw new Error("파싱된 데이터에서 유효한 문항(숫자 헤더)을 찾을 수 없습니다.");
    }
    
    answerRates = Array(questionCount).fill(0); // ⭐️ 정답률 배열 초기화

    // 2. 학생 데이터 순회
    rawData.forEach((row, index) => {
        
        const studentName = (row["이름"] || row["학생"] || row["학생명"] || "").trim();

        // ⭐️ [수정 1] '/'가 포함된 이름, 통계 이름 필터링 (이전 오류 수정)
        if (!studentName || 
            studentName.includes('/') || 
            studentName === "평균점수" || 
            studentName.includes("정답률") || 
            studentName.includes("반평균")
        ) {
            return; // 이 행은 학생이 아니므로 건너뜁니다.
        }
        
        // ⭐️ [수정 2] CSV 파일의 "점수\문제" 헤더를 인식하도록 추가
        const scoreValue = row["총점"] || row["점수"] || row["점수\\문제"];

        // ⭐️ [수정 3] '점' 글자를 제거하고, 값이 없으면 "0"을 기본값으로 하여 NaN 방지
        const scoreString = (scoreValue || "0").toString().replace('점', '');
        const score = parseFloat(scoreString);
        
        if (isNaN(score)) {
            return; // (안전장치) 점수 파싱이 실패하면 건너뜁니다.
        }

        const student = {
            name: studentName,
            score: score,
            submitted: true, 
            answers: [],
            correctCount: 0,
            aiAnalysis: null,
            // ⭐️ [수정 4] 'undefined' 대신 원본 값(예: "65점") 또는 'null'을 저장
            "총점": scoreValue || null
        };
        
        let correctCount = 0;
        
        // O, X 문항 처리
        for (let i = 1; i <= questionCount; i++) {
            const answer = (row[i] || 'X').toString().toUpperCase().trim(); // ⭐️ 기본값 'X'
            const isCorrect = (answer === 'O' || answer === 'TRUE');
            
            student.answers.push({ qNum: i, answer: isCorrect ? 'O' : 'X', isCorrect });
            
            if (isCorrect) {
                correctCount++;
                answerRates[i - 1]++; // ⭐️ 정답자 수 누적
            }
        }
        
        student.correctCount = correctCount;
        students.push(student);
        totalScore += student.score;
    });

    if (students.length === 0) {
        throw new Error("유효한 학생 데이터를 찾을 수 없습니다. (필터링 후 0명)");
    }

    // 3. 통계 계산
    const classAverage = totalScore / students.length;
    const finalAnswerRates = answerRates.map(count => (count / students.length) * 100);

    return {
        students: students,
        studentCount: students.length,
        classAverage: parseFloat(classAverage.toFixed(1)),
        questionCount: questionCount,
        answerRates: finalAnswerRates.map(rate => parseFloat(rate.toFixed(1)))
    };
};


// -------------------------------------------------------------------
// 5. 파일 쌍 매칭
// -------------------------------------------------------------------
const getBaseName = (fileName) => {
    // .pdf, .csv, .xlsx 등의 확장자 제거
    let base = fileName.split('.').slice(0, -1).join('.');
    // '정오표' 같은 특정 단어 제거 (필요시)
    base = base.replace(/_정오표| 정오표|-정오표/gi, ''); 
    return base;
};

export const pairFiles = (files) => {
    const fileMap = {};
    const paired = {};

    files.forEach(file => {
        const baseName = getBaseName(file.name);
        if (!fileMap[baseName]) {
            fileMap[baseName] = {};
        }
        if (file.name.toLowerCase().endsWith('.pdf')) {
            fileMap[baseName].pdf = file;
        } else if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.xlsx')) {
            fileMap[baseName].spreadsheet = file;
        }
    });

    for (const baseName in fileMap) {
        if (fileMap[baseName].pdf && fileMap[baseName].spreadsheet) {
            // ⭐️ 반 이름(Key)으로 baseName을 사용
            paired[baseName] = fileMap[baseName]; 
        }
    }
    return paired;
};