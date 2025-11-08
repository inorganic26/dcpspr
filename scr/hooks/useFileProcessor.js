// scr/hooks/useFileProcessor.js

import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 
import { saveNewReport } from './useFirebase'; 
import pLimit from 'p-limit'; 

const limit = pLimit(5); 

// --- [기존] '파일 업로드' 모드를 위한 배치 함수 (변경 없음) ---
async function processClassBatch(className, classFiles, uploadDate, setErrorMessage) {
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
        getQuestionUnitMapping(commonData) 
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


// --- ⭐️ [신규] '직접 입력' 모드를 위한 배치 함수 ---
async function processDirectInputBatch(className, pdfFile, directStudents, uploadDate, setErrorMessage) {
    
    setErrorMessage(`'${className}' PDF 파싱 및 데이터 처리 중...`);
    
    // 1. PDF 파싱
    const pdfText = await parsePDF(pdfFile);
    
    // 2. '직접 입력' 데이터를 'fileParser'로 전달하여 통계 계산
    // (App.jsx에서 'fileParser'가 이해하는 형식으로 데이터를 만들었기 때문에 재사용 가능)
    const studentData = processStudentData(directStudents);

    // 3. AI 분석용 공통 데이터 생성
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
    
    // 4. AI 분석 호출
    const [aiOverall, unitMap] = await Promise.all([
        getOverallAIAnalysis(commonData), 
        getQuestionUnitMapping(commonData) 
    ]);

    // 5. 최종 데이터 정리
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
export const useFileProcessor = () => { // ⭐️ props 제거
    const { 
        setProcessing, setErrorMessage, 
        setReportSummaries,
        setCurrentPage, uploadDate, setSelectedDate,
        currentTeacher, 
        // ⭐️ [신규] App.jsx의 'selectedFiles' 상태를 직접 가져옴
        selectedFiles, setSelectedFiles
    } = useReportContext();
    
    const fileInputRef = useRef(null);
    // ⭐️ [수정] 'selectedFiles' 상태는 이제 Context에서 관리

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

    // ⭐️ [수정] 'handleFileProcess'가 App.jsx에서 인자를 받도록 변경
    const handleFileProcess = useCallback(async (inputType, directInput) => {
        if (!currentTeacher) { 
            setErrorMessage('로그인이 필요합니다. 앱을 새로고침하여 다시 로그인해주세요.');
            return;
        }
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }
        
        // 1. PDF 파일은 항상 필수
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
                            setErrorMessage 
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
                
                // ⭐️ [신규] '직접 입력'용 배치 함수 호출
                const { studentData, commonData } = await processDirectInputBatch(
                    className,
                    pdfFile,
                    students,
                    uploadDate,
                    setErrorMessage
                );

                setErrorMessage(`'${className}' 분석 완료! DB에 저장 중...`);
                
                const reportId = await saveNewReport(
                    className, uploadDate, studentData, commonData   
                );
                
                console.log(`--- [${className}] (직접 입력) AI 공통 분석 및 저장 완료 ---`);
                newSummaries.push({ id: reportId, className, date: uploadDate, studentCount: studentData.studentCount });
            }
            
            // --- 3. 공통 완료 로직 ---
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
            // ⭐️ '파일' 모드였을 때만 파일 목록 초기화
            if (inputType === 'file') { 
                setSelectedFiles([]);
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        }
    }, [
        // ⭐️ [수정] 의존성 배열 변경
        currentTeacher, uploadDate, selectedFiles, 
        setProcessing, setErrorMessage, setReportSummaries, 
        setCurrentPage, setSelectedDate, setSelectedFiles
    ]);

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};