import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
// ⚠️ 주의: pairFiles 함수는 scr/lib/fileParser.js에 있어야 합니다.
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 

export const useFileProcessor = ({ saveDataToFirestore }) => {
    const { 
        setProcessing, setErrorMessage, setTestData, 
        setCurrentPage, uploadDate, setUploadDate, setSelectedDate
    } = useReportContext();
    
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
            setErrorMessage('');
        }
    };
    
    // 이 함수는 App.jsx에서 드래그 앤 드롭을 처리하기 위해 사용됩니다.
    const handleFileDrop = (files) => {
        if (files) {
            setSelectedFiles(Array.from(files));
            setErrorMessage('');
        }
    };

    const handleFileProcess = useCallback(async () => {
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }

        setProcessing(true);
        setErrorMessage('');
        
        // pairFiles 함수가 fileParser.js 파일에 있다고 가정합니다.
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
                // 1. 파일 파싱
                const pdfText = await parsePDF(pdf);
                const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
                    await parseCSV(spreadsheet) : 
                    await parseXLSX(spreadsheet);
                
                const studentData = processStudentData(spreadsheetData);
                
                // 2. 데이터 기본 구조 생성
                mergedData[key] = {
                    [uploadDate]: {
                        pdfInfo: { fileName: pdf.name, fullText: pdfText },
                        studentData: studentData,
                        aiOverallAnalysis: null,
                        questionUnitMap: null,
                    }
                };
                const overallData = mergedData[key][uploadDate];

                // ⭐️ 3. [수정됨] AI 분석 2개를 파일 처리 시점에 미리 호출
                // 🚨 런타임 오류 수정: 두 번째 인수를 제거합니다.
                setProcessing(true); 
                
                const overallPromise = getOverallAIAnalysis(overallData);
                const unitMapPromise = getQuestionUnitMapping(overallData);

                // ⭐️ 4. AI 분석 결과를 기다림
                const [aiOverall, unitMap] = await Promise.all([overallPromise, unitMapPromise]);
                
                // ⭐️ 5. AI 결과를 데이터에 저장
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
            // ⭐️ 6. AI 분석이 포함된 데이터를 DB에 저장
            await saveDataToFirestore(mergedData); 
            
            // ⭐️ 7. 전역 상태도 AI 분석이 포함된 데이터로 업데이트
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

    // handleFileDrop 함수를 반환 목록에 추가합니다.
    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};