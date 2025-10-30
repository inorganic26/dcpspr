import { useState, useRef, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { pairFiles, parseCSV, parseXLSX, parsePDF, processStudentData } from '../lib/fileParser.js';

export const useFileProcessor = ({ saveDataToFirestore }) => {
    const { 
        testData, setTestData, setCurrentPage, 
        processing, setProcessing, setErrorMessage,
        uploadDate // ⭐️ Context에서 업로드 날짜 가져오기
    } = useReportContext();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(files);
        setErrorMessage('');
    };

    const handleFileProcess = useCallback(async () => {
        setProcessing(true);
        setErrorMessage('');

        // ⭐️⭐️⭐️ 변경된 부분 (날짜 확인) ⭐️⭐️⭐️
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 입력해주세요. (예: 10월 30일)');
            setProcessing(false);
            return;
        }
        // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️

        if (selectedFiles.length === 0) {
            setErrorMessage('파일을 선택해주세요.');
            setProcessing(false);
            return;
        }

        const pairedFiles = pairFiles(selectedFiles);
        
        if (Object.keys(pairedFiles).length === 0) {
            setErrorMessage('올바르게 페어링된 PDF와 CSV/XLSX 파일이 없습니다. 파일 이름에서 "반 이름"을 감지할 수 있는지 확인해주세요.');
            setProcessing(false);
            return;
        }

        let newTestData = JSON.parse(JSON.stringify(testData)); 
        let successCount = 0;
        let errorMessages = [];
        
        const pairedPdfFiles = Object.values(pairedFiles).map(p => p.pdf).filter(Boolean);
        const textbookFile = selectedFiles.find(f => f.type === 'application/pdf' && !pairedPdfFiles.includes(f));
        const textbookPromise = textbookFile ? parsePDF(textbookFile) : Promise.resolve('');


        const processingPromises = Object.keys(pairedFiles).map(async (key) => {
            const pair = pairedFiles[key];
            if (pair.spreadsheet && pair.pdf) {
                try {
                    // ⭐️⭐️⭐️ 변경된 부분 (key가 반 이름) ⭐️⭐️⭐️
                    const className = key; // key가 이제 반 이름입니다.
                    const date = uploadDate; // 사용자가 입력한 날짜를 사용합니다.
                    // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️

                    let spreadsheetPromise;
                    const extension = pair.spreadsheet.name.split('.').pop()?.toLowerCase();
                    if (extension === 'xlsx') {
                        spreadsheetPromise = parseXLSX(pair.spreadsheet);
                    } else if (extension === 'csv') {
                        spreadsheetPromise = parseCSV(pair.spreadsheet);
                    } else {
                         throw new Error(`지원하지 않는 스프레드시트 형식입니다: ${pair.spreadsheet.name}`);
                    }
                    const pdfPromise = parsePDF(pair.pdf);
                    const [spreadsheetData, pdfText] = await Promise.all([spreadsheetPromise, pdfPromise]);

                    if (!spreadsheetData || !pdfText) {
                         throw new Error(`파일 파싱에 실패했습니다: ${pair.spreadsheet.name} 또는 ${pair.pdf.name}`);
                    }
                    
                    const existingData = testData[className]?.[date];
                    const newData = {
                        pdfInfo: { fullText: pdfText },
                        studentData: processStudentData(spreadsheetData)
                    };
                    
                    if (existingData?.aiOverallAnalysis) newData.aiOverallAnalysis = existingData.aiOverallAnalysis;
                    if (existingData?.questionUnitMap) newData.questionUnitMap = existingData.questionUnitMap;
                    if (existingData?.studentData?.students) {
                        newData.studentData.students.forEach(newStudent => {
                            const oldStudent = existingData.studentData.students.find(s => s.name === newStudent.name);
                            if (oldStudent?.aiAnalysis) newStudent.aiAnalysis = oldStudent.aiAnalysis;
                        });
                    }

                    // ⭐️ key 대신 className과 date를 반환
                    return { key, className, date, data: newData };
                } catch (error) {
                    console.error(`Error processing pair ${key}:`, error);
                    errorMessages.push(`파일 '${pair.spreadsheet?.name || '?'}'/'${pair.pdf?.name || '?'}' 처리 중 오류: ${error.message}`);
                    return null;
                }
            }
            return null;
        });

        try {
            const allResults = await Promise.all([textbookPromise, ...processingPromises]);
            const fileResults = allResults.slice(1);
            
            fileResults.forEach(result => {
                if (result) {
                    // ⭐️⭐️⭐️ 변경된 부분 (저장 경로) ⭐️⭐️⭐️
                    const { className, date, data } = result;
                    if (!newTestData[className]) { newTestData[className] = {}; }
                    newTestData[className][date] = data; 
                    // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
                    successCount++;
                }
            });

            if (successCount > 0) {
                setTestData(newTestData);
                await saveDataToFirestore(newTestData); 
                // ⭐️⭐️⭐️ 변경된 부분 (이동 경로) ⭐️⭐️⭐️
                setCurrentPage('page3'); // ⭐️ 파일 처리 후 '날짜 선택' 화면으로 이동
                // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
            } else if (errorMessages.length === 0) {
                setErrorMessage('처리할 유효한 파일 쌍을 찾지 못했습니다.');
            }
            if (errorMessages.length > 0) {
                setErrorMessage(errorMessages.join('\n'));
            }
        } catch (parseError) {
             setErrorMessage(`파일 처리 중 오류가 발생했습니다: ${parseError.message}`);
        } finally {
            setProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
            setSelectedFiles([]);
        }
    }, [processing, selectedFiles, testData, uploadDate, setProcessing, setErrorMessage, setCurrentPage, setTestData, saveDataToFirestore]); // ⭐️ uploadDate 의존성 추가

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess };
};