// scr/hooks/useFileProcessor.js

import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 
import { saveNewReport } from './useFirebase'; 
import pLimit from 'p-limit'; 

const limit = pLimit(5); 

// ⭐️ [수정] 'subjectKey' 인자 추가
async function processClassBatch(className, classFiles, uploadDate, setErrorMessage, subjectKey) {
    const { pdf, spreadsheet } = classFiles;

    setErrorMessage(`'${className}' 파일 파싱 중...`);
    const pdfText = await parsePDF(pdf);
    const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
        await parseCSV(spreadsheet) : 
        await parseXLSX(spreadsheet);
    
    const studentData = processStudentData(spreadsheetData);
    
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
        getOverallAIAnalysis(commonData), 
        // ⭐️ [수정] 'subjectKey' 전달
        getQuestionUnitMapping(commonData, subjectKey) 
    ]);

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
        studentData: studentData, 
        commonData: finalCommonData 
    };
}


// ⭐️ [수정] 'subjectKey' 인자 추가
async function processDirectInputBatch(className, pdfFile, directStudents, uploadDate, setErrorMessage, subjectKey) {
    
    setErrorMessage(`'${className}' PDF 파싱 및 데이터 처리 중...`);
    
    const pdfText = await parsePDF(pdfFile);
    const studentData = processStudentData(directStudents);

    const commonData = {
        pdfInfo: { fileName: pdfFile.name, fullText: pdfText },
        classAverage: studentData.classAverage,
        questionCount: studentData.questionCount,
        answerRates: studentData.answerRates,
        aiOverallAnalysis: null,
        questionUnitMap: null,
    };

    console.log(`[${className}] Step 1/2: 공통 분석 (총평, 단원맵) 병렬 시작...`);
    setErrorMessage(`'${className}' AI 공통 분석 중... (1/2)`);
    
    const [aiOverall, unitMap] = await Promise.all([
        getOverallAIAnalysis(commonData), 
        // ⭐️ [수정] 'subjectKey' 전달
        getQuestionUnitMapping(commonData, subjectKey) 
    ]);

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
        studentData: studentData, 
        commonData: finalCommonData 
    };
}


// --- ⭐️ [수정] useFileProcessor 훅 ---
export const useFileProcessor = () => { 
    const { 
        setProcessing, setErrorMessage, 
        setReportSummaries,
        setCurrentPage, uploadDate, setSelectedDate,
        currentTeacher, 
        selectedFiles, setSelectedFiles
    } = useReportContext();
    
    const fileInputRef = useRef(null);

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

    // ⭐️ [수정] 'subjectKey' 인자 추가
    const handleFileProcess = useCallback(async (inputType, directInput, subjectKey) => {
        if (!currentTeacher) { 
            setErrorMessage('로그인이 필요합니다. 앱을 새로고침하여 다시 로그인해주세요.');
            return;
        }
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }
        
        const pdfFile = selectedFiles.find(f => f.name.toLowerCase().endsWith('.pdf'));
        if (!pdfFile) {
            setErrorMessage('PDF 시험지 파일을 찾을 수 없습니다. (필수)');
            return;
        }

        setProcessing(true);
        let hasError = false;
        const newSummaries = []; 

        try {
            // --- ⭐️ [신규] 로직 분기 ---
            if (inputType === 'file') {
                // --- 2a. '파일 업로드' 모드 (기존 로직) ---
                setErrorMessage('파일 매칭 중...');
                const pairedFiles = pairFiles(selectedFiles); 
                const classNames = Object.keys(pairedFiles);
                
                if (classNames.length === 0) {
                    throw new Error('파일 쌍(PDF 1개 + 성적표 1개)을 찾을 수 없습니다. 파일 이름을 확인해주세요.');
                }

                const processTasks = classNames.map(className => {
                    return limit(async () => {
                        console.log(`--- [${className}] AI 공통 분석 시작 ---`);
                        const { studentData, commonData } = await processClassBatch(
                            className, 
                            pairedFiles[className], 
                            uploadDate,
                            setErrorMessage,
                            subjectKey // ⭐️ 전달
                        );
                        
                        setErrorMessage(`'${className}' 분석 완료! DB에 저장 중...`);
                        
                        const reportId = await saveNewReport(
                            className, uploadDate, studentData, commonData   
                        );
                        
                        console.log(`--- [${className}] AI 공통 분석 및 저장 완료 ---`);
                        return { id: reportId, className, date: uploadDate, studentCount: studentData.studentCount };
                    });
                });

                const results = await Promise.all(processTasks);
                results.forEach(summary => { if (summary) newSummaries.push(summary); });

            } else {
                // --- 2b. '직접 입력' 모드 (신규 로직) ---
                const { className, students } = directInput;
                if (!className || students.length === 0) {
                    throw new Error("'직접 입력' 모드에서는 반 이름과 1명 이상의 학생 정보가 필요합니다.");
                }

                console.log(`--- [${className}] (직접 입력) AI 공통 분석 시작 ---`);
                
                const { studentData, commonData } = await processDirectInputBatch(
                    className,
                    pdfFile,
                    students,
                    uploadDate,
                    setErrorMessage,
                    subjectKey // ⭐️ 전달
                );

                setErrorMessage(`'${className}' 분석 완료! DB에 저장 중...`);
                
                const reportId = await saveNewReport(
                    className, uploadDate, studentData, commonData   
                );
                
                console.log(`--- [${className}] (직접 입력) AI 공통 분석 및 저장 완료 ---`);
                newSummaries.push({ id: reportId, className, date: uploadDate, studentCount: studentData.studentCount });
            }
            
            setErrorMessage('모든 분석 완료!');
            setReportSummaries(prevSummaries => [...prevSummaries, ...newSummaries]);
            setErrorMessage(''); 
            setSelectedDate(uploadDate); 
            setCurrentPage('page2'); 

        } catch (error) {
            console.error(`파일 처리 중 오류:`, error);
            setErrorMessage(`파일 처리 오류: ${error.message}.`);
            hasError = true;
        } finally {
            setProcessing(false);
            if (inputType === 'file') { 
                setSelectedFiles([]);
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    }, [
        currentTeacher, uploadDate, selectedFiles, 
        setProcessing, setErrorMessage, setReportSummaries, 
        setCurrentPage, setSelectedDate, setSelectedFiles
    ]);

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};