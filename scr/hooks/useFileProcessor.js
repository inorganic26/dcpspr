// scr/hooks/useFileProcessor.js

import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
// ⭐️ [수정] convertPdfToImages 임포트
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData, convertPdfToImages } from '../lib/fileParser'; 
// ⭐️ [수정] getQuestionDifficultyMapping은 ai.js 내부로 통합됨
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 
import { saveNewReport } from './useFirebase'; 
import pLimit from 'p-limit'; 

const limit = pLimit(1); // ⭐️ [수정] Vision API 동시 호출 방지를 위해 1로 제한

// ⭐️ [신규] PDF 분석 및 캐싱을 위한 헬퍼 함수
async function getOrCachePdfAnalysis(
    pdfFile, 
    questionCount, // ⭐️ 첫 번째 반의 통계 기준
    classAverage, 
    answerRates, 
    subjectKey, 
    analysisCache, // ⭐️ Map() 객체
    setErrorMessage
) {
    const pdfName = pdfFile.name;
    
    // 1. 캐시 확인
    if (analysisCache.has(pdfName)) {
        console.log(`[Cache] '${pdfName}'의 AI 분석 결과를 캐시에서 재사용합니다.`);
        return analysisCache.get(pdfName);
    }

    // 2. 캐시가 없으면 AI 분석 실행
    console.log(`[AI Analysis] '${pdfName}'의 새 AI 분석을 시작합니다.`);
    
    // ⭐️ [신규] PDF 텍스트 추출과 이미지 변환을 병렬로 실행
    setErrorMessage(`'${pdfName}' PDF 파싱 중 (텍스트/이미지)...`);
    const [pdfText, pdfImages] = await Promise.all([
        parsePDF(pdfFile),
        convertPdfToImages(pdfFile) // ⭐️ Vision용 이미지 생성
    ]);

    const commonDataForTextAI = {
        pdfInfo: { fileName: pdfName, fullText: pdfText },
        classAverage: classAverage, 
        questionCount: questionCount,
        answerRates: answerRates, 
    };

    // ⭐️ [신규] AI 호출 2개 병렬 실행 (Vision 1회, Text 1회)
    setErrorMessage(`'${pdfName}' AI 분석 중 (Vision/Text)...`);
    
    // ⭐️ pLimit을 사용하지 않고 직접 Promise.all 호출
    const [aiOverallResult, unitMapResult] = await Promise.all([
        // ⭐️ 저렴한 2.5-flash (Text)로 총평 분석
        getOverallAIAnalysis(commonDataForTextAI),
        
        // ⭐️ 비싼 1.5-pro (Vision)로 "마스터 분석표" 생성
        getQuestionUnitMapping(pdfImages, questionCount, subjectKey) 
    ]);


    // ⭐️ "마스터 분석표"
    if (!unitMapResult || !unitMapResult.question_analysis) {
        throw new Error(`'${pdfName}'의 Vision 문항 분석(unitMap) 생성에 실패했습니다.`);
    }
    
    const analysisResult = {
        pdfInfo: commonDataForTextAI.pdfInfo, // ⭐️ 파싱된 PDF 텍스트
        aiOverallAnalysis: aiOverallResult,  // ⭐️ Flash Text 총평
        questionUnitMap: unitMapResult       // ⭐️ Pro Vision 마스터 분석표
    };
    
    // 3. 캐시에 저장
    analysisCache.set(pdfName, analysisResult);
    return analysisResult;
}


// --- ⭐️ [수정] useFileProcessor 훅 (로직 대폭 수정) ---
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
        
        // ⭐️ [신규] PDF 분석 결과를 캐시할 Map
        const analysisCache = new Map();

        setProcessing(true);
        let hasError = false;
        const newSummaries = []; 

        try {
            if (inputType === 'file') {
                // --- '파일 업로드' 모드 ---
                setErrorMessage('파일 매칭 중...');
                const pairedFiles = pairFiles(selectedFiles); 
                const classNames = Object.keys(pairedFiles);
                
                if (classNames.length === 0) {
                    throw new Error('파일 쌍(PDF 1개 + 성적표 1개)을 찾을 수 없습니다. 파일 이름을 확인해주세요.');
                }
                
                // ⭐️ [수정] pLimit 대신, classNames를 순회하며 처리
                for (const className of classNames) {
                    const { pdf: pdfFile, spreadsheet } = pairedFiles[className];
                    
                    setErrorMessage(`'${className}' 엑셀 파일 파싱 중...`);
                    
                    // 1. 엑셀 파싱 (학생 데이터 및 통계)
                    const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
                        await parseCSV(spreadsheet) : 
                        await parseXLSX(spreadsheet);
                    const studentData = processStudentData(spreadsheetData);

                    // 2. ⭐️ AI 공통 분석 (캐시 확인)
                    const { pdfInfo, aiOverallAnalysis, questionUnitMap } = await getOrCachePdfAnalysis(
                        pdfFile,
                        studentData.questionCount,
                        studentData.classAverage,
                        studentData.answerRates,
                        subjectKey,
                        analysisCache,
                        setErrorMessage
                    );
                    
                    const finalCommonData = { pdfInfo, aiOverallAnalysis, questionUnitMap };

                    // 3. DB 저장
                    setErrorMessage(`'${className}' DB 저장 중...`);
                    const reportId = await saveNewReport(
                        className, uploadDate, studentData, finalCommonData
                    );
                    
                    newSummaries.push({ id: reportId, className, date: uploadDate, studentCount: studentData.studentCount });
                    console.log(`--- [${className}] 처리 완료 ---`);
                }

            } else {
                // --- '직접 입력' 모드 ---
                const { className, students } = directInput;
                if (!className || students.length === 0) {
                    throw new Error("'직접 입력' 모드에서는 반 이름과 1명 이상의 학생 정보가 필요합니다.");
                }
                
                const pdfFile = selectedFiles.find(f => f.name.toLowerCase().endsWith('.pdf'));
                if (!pdfFile) {
                    throw new Error('PDF 시험지 파일을 찾을 수 없습니다. (필수)');
                }

                console.log(`--- [${className}] (직접 입력) 처리 시작 ---`);
                
                // 1. 학생 데이터 파싱
                const studentData = processStudentData(students);

                // 2. ⭐️ AI 공통 분석 (캐시 확인)
                const { pdfInfo, aiOverallAnalysis, questionUnitMap } = await getOrCachePdfAnalysis(
                    pdfFile,
                    studentData.questionCount,
                    studentData.classAverage,
                    studentData.answerRates,
                    subjectKey,
                    analysisCache,
                    setErrorMessage
                );
                
                const finalCommonData = { pdfInfo, aiOverallAnalysis, questionUnitMap };

                // 3. DB 저장
                setErrorMessage(`'${className}' DB 저장 중...`);
                const reportId = await saveNewReport(
                    className, uploadDate, studentData, finalCommonData
                );
                
                newSummaries.push({ id: reportId, className, date: uploadDate, studentCount: studentData.studentCount });
                console.log(`--- [${className}] (직접 입력) 처리 완료 ---`);
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