import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { getAIAnalysis, getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js';
import { generateOverallReportHTML, generateIndividualReportHTML } from '../lib/reportUtils.js';

export const useReportGenerator = ({ saveDataToFirestore }) => {
    const { 
        testData, setTestData, currentPage, 
        selectedClass, selectedDate, selectedStudent,
        aiLoading, setAiLoading, // ⭐️ 1. aiLoading을 Context에서 가져옵니다.
        setReportHTML,
        setCurrentPage, setErrorMessage, setReportCurrentPage
    } = useReportContext();
    
    // ⭐️ AI 분석 및 리포트 생성 함수
    const renderReport = useCallback(async () => {
        setAiLoading(true); 
        
        // 2. ⭐️ testData에서 현재 데이터를 동기적으로 가져옵니다.
        const currentData = testData[selectedClass]?.[selectedDate];
        if (!currentData) {
            setErrorMessage('리포트 데이터를 찾을 수 없습니다.');
            setCurrentPage('page4');
            setAiLoading(false);
            return;
        }

        const student = selectedStudent ? currentData.studentData?.students?.find(s => s.name === selectedStudent) : null;
        if (selectedStudent && !student) {
            setErrorMessage(`학생 '${selectedStudent}' 데이터가 없습니다.`);
            setCurrentPage('page4');
            setAiLoading(false);
            return;
        }

        // 3. ⭐️ "AI 분석 대기 중..."이 포함된 뼈대 HTML을 먼저 렌더링합니다.
        const skeletonHtml = selectedStudent ?
            generateIndividualReportHTML(student, currentData, undefined, currentData.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(currentData, currentData.aiOverallAnalysis, selectedClass, selectedDate);
        
        setReportHTML(skeletonHtml);
        setReportCurrentPage(1);

        // 4. ⭐️ AI 분석 실행
        let dataWasUpdated = false;
        let newTestData = JSON.parse(JSON.stringify(testData)); // 수정할 데이터 복사본
        let currentDataForAI = newTestData[selectedClass]?.[selectedDate];
        let studentForAI = selectedStudent ? currentDataForAI.studentData?.students?.find(s => s.name === selectedStudent) : null;
        
        const analysisPromises = [];

        // ⭐️ AI 데이터가 없으면 API 호출 리스트에 추가
        if (!currentDataForAI.aiOverallAnalysis) {
            analysisPromises.push(
                getOverallAIAnalysis(currentDataForAI) 
                    .then(res => { if(res) { currentDataForAI.aiOverallAnalysis = res; dataWasUpdated = true; } })
            );
        }
        if (!currentDataForAI.questionUnitMap) {
            analysisPromises.push(
                getQuestionUnitMapping(currentDataForAI)
                    .then(res => { if(res) { currentDataForAI.questionUnitMap = res; dataWasUpdated = true; } })
            );
        }
        if (selectedStudent && studentForAI && studentForAI.submitted && !studentForAI.aiAnalysis) {
            analysisPromises.push(
                getAIAnalysis(studentForAI, currentDataForAI, selectedClass) 
                    .then(res => { if(res) { studentForAI.aiAnalysis = res; dataWasUpdated = true; } })
            );
        }
        
        try {
            await Promise.all(analysisPromises);
        } catch (e) {
            setErrorMessage('AI 분석 중 오류가 발생했습니다: ' + e.message);
            setAiLoading(false);
            return;
        }

        // 5. ⭐️ 새 AI 데이터가 있을 때만 DB 저장 및 상태 업데이트 (무한 루프 방지)
        if (dataWasUpdated) {
            try {
                await saveDataToFirestore(newTestData);
                setTestData(newTestData); // ⭐️ AI 분석이 완료된 새 데이터로 상태 업데이트
            } catch (error) {
                setErrorMessage('분석 결과 저장 중 오류 발생: ' + error.message);
            }
        }
        
        // 6. ⭐️ 최종 HTML 생성
        // dataWasUpdated가 true면 AI 분석이 끝난 newTestData를 사용하고,
        // false면 (캐시된 데이터) 기존 currentData를 사용합니다.
        const finalData = dataWasUpdated ? currentDataForAI : currentData;
        const finalStudent = dataWasUpdated ? studentForAI : student;
        
        const finalHtml = selectedStudent ?
            generateIndividualReportHTML(finalStudent, finalData, finalStudent?.aiAnalysis, finalData?.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(finalData, finalData?.aiOverallAnalysis, selectedClass, selectedDate);

        setReportHTML(finalHtml); // ⭐️ AI 결과가 반영된 최종 HTML로 업데이트
        setAiLoading(false);
        
    }, [ 
        // ⭐️ testData가 의존성에 포함되어야 합니다.
        testData, selectedClass, selectedDate, selectedStudent, 
        setAiLoading, setReportHTML, setErrorMessage, setCurrentPage, 
        setTestData, saveDataToFirestore, setReportCurrentPage
    ]);

    // ⭐️ 이 useEffect가 `renderReport` 콜백을 실행합니다.
    useEffect(() => {
        if (currentPage === 'page5') {
            renderReport();
        }
    }, [currentPage, renderReport]); // ⭐️ `renderReport`는 useCallback으로 감싸져 있으므로 안전합니다.

    return { aiLoading };
};