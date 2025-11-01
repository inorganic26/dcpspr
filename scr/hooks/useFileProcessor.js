import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser';
// ⭐️ 1. AI 함수 2개 임포트
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 

export const useFileProcessor = ({ saveDataToFirestore }) => {
    const { 
        setProcessing, setErrorMessage, setTestData, 
        setCurrentPage, uploadDate, setUploadDate, setSelectedDate
    } = useReportContext();
    
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const handleFileChange = (e) => {
        setSelectedFiles(Array.from(e.target.files));
        setErrorMessage('');
    };

    const handleFileProcess = useCallback(async () => {
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }

        setProcessing(true);
        setErrorMessage('');

        const pairedFiles = pairFiles(selectedFiles);
        const classNames = Object.keys(pairedFiles);
        if (classNames.length === 0) {
            setErrorMessage('파일 쌍(PDF 1개 + 성적표 1개)을 찾을 수 없습니다. 파일 이름을 확인해주세요 (예: "고1A반 시험지.pdf", "고1A반 성적표.csv")');
            setProcessing(false);
            return;
        }

        let hasError = false;
        let mergedData = {};

        for (const key of classNames) {
            const { pdf, spreadsheet } = pairedFiles[key];
            try {
                // 1. 파일 파싱 (기존과 동일)
                const pdfText = await parsePDF(pdf);
                const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
                    await parseCSV(spreadsheet) : 
                    await parseXLSX(spreadsheet);
                
                const studentData = processStudentData(spreadsheetData);
                
                // 2. 데이터 기본 구조 생성 (기존과 동일)
                mergedData[key] = {
                    [uploadDate]: {
                        pdfInfo: { fileName: pdf.name, fullText: pdfText },
                        studentData: studentData,
                        aiOverallAnalysis: null, // (곧 채워짐)
                        questionUnitMap: null, // (곧 채워짐)
                    }
                };
                const overallData = mergedData[key][uploadDate];

                // ⭐️ 3. [변경] AI 분석 2개를 파일 처리 시점에 미리 호출
                setProcessing(true, `"${key}" 반 AI 분석 중...`);
                
                const overallPromise = getOverallAIAnalysis(overallData);
                const unitMapPromise = getQuestionUnitMapping(overallData);

                // ⭐️ 4. [변경] AI 분석 결과를 기다림
                const [aiOverall, unitMap] = await Promise.all([overallPromise, unitMapPromise]);
                
                // ⭐️ 5. [변경] AI 결과를 데이터에 저장
                overallData.aiOverallAnalysis = aiOverall;
                overallData.questionUnitMap = unitMap;

            } catch (error) {
                console.error(`Error processing files for ${key}:`, error);
                setErrorMessage(`"${key}" 처리 오류: ${error.message}`);
                hasError = true;
                break;
            }
        }

        if (hasError) {
            setProcessing(false);
            return;
        }

        try {
            // ⭐️ 6. [변경] AI 분석이 포함된 데이터를 DB에 저장
            await saveDataToFirestore(mergedData); 
            
            // ⭐️ 7. [변경] 전역 상태도 AI 분석이 포함된 데이터로 업데이트
            setTestData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));
                Object.keys(mergedData).forEach(className => {
                    if (!newData[className]) newData[className] = {};
                    newData[className][uploadDate] = mergedData[className][uploadDate];
                });
                return newData;
            });
            
            setSelectedDate(uploadDate);
            setCurrentPage('page2'); // 반 선택 페이지로 이동

        } catch (error) {
            setErrorMessage('데이터 저장 중 오류 발생: ' + error.message);
        } finally {
            setProcessing(false);
            setSelectedFiles([]);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [selectedFiles, uploadDate, saveDataToFirestore, setProcessing, setErrorMessage, setTestData, setCurrentPage, setSelectedDate]);

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess };
};