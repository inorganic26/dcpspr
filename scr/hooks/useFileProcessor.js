// scr/hooks/useFileProcessor.js

import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 
import { saveNewReport } from './useFirebase'; 
// ⭐️ [수정] 'pLimit' -> 'p-limit' (하이픈 추가)
import pLimit from 'p-limit'; 

const limit = pLimit(5); 

async function processClassBatch(className, classFiles, uploadDate, setErrorMessage) {
    const { pdf, spreadsheet } = classFiles;

    setErrorMessage(`'${className}' 파일 파싱 중...`);
    const pdfText = await parsePDF(pdf);
    const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
        await parseCSV(spreadsheet) : 
        await parseXLSX(spreadsheet);
    
    const studentData = processStudentData(spreadsheetData);
    
    // AI 함수에 전달할 'commonData' 객체 (평평하게 수정)
    const commonData = {
        pdfInfo: { fileName: pdf.name, fullText: pdfText },
        
        classAverage: studentData.classAverage,
        questionCount: studentData.questionCount,
        answerRates: studentData.answerRates,
        
        aiOverallAnalysis: null,
        questionUnitMap: null,
    };

    console.log(`[${className}] Step 1/2: 공통 분석 (총평, 단원맵) 병렬 시작...`);
    setErrorMessage(`'${className}' AI 공통 분석 중... (1/2)`);
    
    const [aiOverall, unitMap] = await Promise.all([
        getOverallAIAnalysis(commonData), // ⭐️ 수정된 commonData 전달
        getQuestionUnitMapping(commonData) // ⭐️ 수정된 commonData 전달
    ]);

    // 최종 commonData에 AI 결과물 저장
    const finalCommonData = {
        pdfInfo: commonData.pdfInfo,
        aiOverallAnalysis: aiOverall,
        questionUnitMap: unitMap,
    };

    if (!unitMap || !unitMap.question_units) {
        throw new Error(`'${className}'의 문항-단원 맵(unitMap) 생성에 실패했습니다. AI 분석을 중단합니다.`);
    }

    console.log(`[${className}] Step 2/2: 공통 분석 완료.`);
    
    return {
        studentData: studentData, // (학생 데이터는 별도로)
        commonData: finalCommonData // (공통 데이터는 별도로)
    };
}


// --- useFileProcessor 훅 ---
export const useFileProcessor = ({ /* saveDataToFirestore 제거 */ }) => {
    const { 
        setProcessing, setErrorMessage, 
        setReportSummaries,
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

        let hasError = false;
        const newSummaries = []; 

        // ⭐️ [수정] 병렬 처리를 위해 pLimit 사용
        const processTasks = classNames.map(className => {
            return limit(async () => {
                if (hasError) return null; // 에러가 발생하면 더 이상 실행하지 않음

                console.log(`--- [${className}] AI 공통 분석 시작 ---`);
                const { studentData, commonData } = await processClassBatch(
                    className, 
                    pairedFiles[className], 
                    uploadDate,
                    setErrorMessage 
                );
                
                setErrorMessage(`'${className}' 분석 완료! DB에 저장 중...`);
                
                const reportId = await saveNewReport(
                    className, 
                    uploadDate, 
                    studentData, 
                    commonData   
                );

                console.log(`--- [${className}] AI 공통 분석 및 저장 완료 ---`);
                return {
                    id: reportId,
                    className: className,
                    date: uploadDate,
                    studentCount: studentData.studentCount
                };
            });
        });

        try {
            // ⭐️ [수정] Promise.all로 병렬 작업 실행
            const results = await Promise.all(processTasks);
            
            // ⭐️ [수정] 결과 취합
            results.forEach(summary => {
                if (summary) newSummaries.push(summary);
            });

        } catch (error) {
            console.error(`Error processing files in parallel:`, error);
            setErrorMessage(`파일 병렬 처리 오류: ${error.message}. 프로세스를 중단합니다.`);
            hasError = true;
        }

        if (hasError) {
            setProcessing(false);
            return;
        }

        try {
            setErrorMessage('모든 분석 완료!');
            setReportSummaries(prevSummaries => [...prevSummaries, ...newSummaries]);
            setErrorMessage(''); 
            setSelectedDate(uploadDate); 
            setCurrentPage('page2'); 

        } catch (error) {
            setErrorMessage('데이터 저장 후 로컬 상태 업데이트 중 오류: ' + error.message);
        } finally {
            setProcessing(false);
            setSelectedFiles([]);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [
        selectedFiles, uploadDate, setProcessing, 
        setErrorMessage, setReportSummaries, setCurrentPage, setSelectedDate, 
        currentTeacher
    ]);

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};