// scr/hooks/useFileProcessor.js

import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
// ⭐️ 이 파일은 fileParser.js에서 함수만 가져와야 합니다.
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 
import pLimit from 'p-limit'; 

const limit = pLimit(5); 

async function processClassBatch(className, classFiles, uploadDate, setErrorMessage) {
    const { pdf, spreadsheet } = classFiles;

    setErrorMessage(`'${className}' 파일 파싱 중...`);
    // ⭐️ 여기서 parsePDF를 호출합니다.
    const pdfText = await parsePDF(pdf);
    const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
        await parseCSV(spreadsheet) : 
        await parseXLSX(spreadsheet);
    
    const studentData = processStudentData(spreadsheetData);
    
    const dataForThisDate = {
        pdfInfo: { fileName: pdf.name, fullText: pdfText },
        studentData: studentData,
        aiOverallAnalysis: null,
        questionUnitMap: null,
    };

    console.log(`[${className}] Step 1/2: 공통 분석 (총평, 단원맵) 병렬 시작...`);
    setErrorMessage(`'${className}' AI 공통 분석 중... (1/2)`);
    
    const [aiOverall, unitMap] = await Promise.all([
        getOverallAIAnalysis(dataForThisDate),
        getQuestionUnitMapping(dataForThisDate)
    ]);

    dataForThisDate.aiOverallAnalysis = aiOverall;
    dataForThisDate.questionUnitMap = unitMap;

    if (!unitMap || !unitMap.question_units) {
        throw new Error(`'${className}'의 문항-단원 맵(unitMap) 생성에 실패했습니다. AI 분석을 중단합니다.`);
    }

    console.log(`[${className}] Step 2/2: 공통 분석 완료.`);
    return dataForThisDate;
}


// --- useFileProcessor 훅 ---
export const useFileProcessor = ({ saveDataToFirestore }) => {
    const { 
        setProcessing, setErrorMessage, setTestData, 
        setCurrentPage, uploadDate, setSelectedDate,
        currentTeacher 
    } = useReportContext();
    
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
            setErrorMessage('');
        }
    };
    
    const handleFileDrop = (files) => {
        if (files) {
            setSelectedFiles(Array.from(files));
            setErrorMessage('');
        }
    };

    const handleFileProcess = useCallback(async () => {
        if (!currentTeacher) { 
            setErrorMessage('로그인이 필요합니다. 앱을 새로고침하여 다시 로그인해주세요.');
            return;
        }
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }

        setProcessing(true);
        setErrorMessage('파일 매칭 중...');
        
        const pairedFiles = pairFiles(selectedFiles); 
        const classNames = Object.keys(pairedFiles);
        
        if (classNames.length === 0) {
            setErrorMessage('파일 쌍(PDF 1개 + 성적표 1개)을 찾을 수 없습니다. 파일 이름을 확인해주세요 (예: "고1A반 시험지.pdf", "고1A반 성적표.csv")');
            setProcessing(false);
            return;
        }

        let allAnalysedData = {};
        let hasError = false;

        for (const className of classNames) {
            try {
                console.log(`--- [${className}] AI 공통 분석 시작 ---`);

                const singleClassFullData = await processClassBatch(
                    className, 
                    pairedFiles[className], 
                    uploadDate,
                    setErrorMessage 
                );
                
                allAnalysedData[className] = {
                    [uploadDate]: singleClassFullData
                };

                console.log(`--- [${className}] AI 공통 분석 완료 ---`);

            } catch (error) {
                console.error(`Error processing files for ${className}:`, error);
                setErrorMessage(`"${className}" 처리 오류: ${error.message}. 프로세스를 중단합니다.`);
                hasError = true;
                break; 
            }
        }

        if (hasError) {
            setProcessing(false);
            return;
        }

        try {
            setErrorMessage('모든 분석 완료! DB에 저장 중...');
            
            await saveDataToFirestore(allAnalysedData); 
            
            setTestData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData)); 
                Object.keys(allAnalysedData).forEach(className => {
                    if (!newData[className]) newData[className] = {};
                    newData[className][uploadDate] = allAnalysedData[className][uploadDate];
                });
                return newData;
            });
            
            setErrorMessage(''); 
            setSelectedDate(uploadDate);
            setCurrentPage('page2'); 

        } catch (error) {
            setErrorMessage('데이터 저장 중 오류 발생: ' + error.message);
        } finally {
            setProcessing(false);
            setSelectedFiles([]);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [
        selectedFiles, uploadDate, saveDataToFirestore, setProcessing, 
        setErrorMessage, setTestData, setCurrentPage, setSelectedDate, 
        currentTeacher
    ]);

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};