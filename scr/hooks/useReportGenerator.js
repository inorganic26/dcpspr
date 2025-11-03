import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
// ⚠️ 1. AI 관련 모든 import 제거
// import { getAIAnalysis, getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js';
import { generateOverallReportHTML, generateIndividualReportHTML } from '../lib/reportUtils.js';

// ⚠️ 2. saveDataToFirestore prop이 더 이상 필요하지 않습니다.
export const useReportGenerator = (/* { saveDataToFirestore } */) => {
    const { 
        testData,
        currentPage, 
        selectedClass, selectedDate, selectedStudent,
        // ⚠️ 3. aiLoading 관련 상태 제거 (로딩은 업로드 시점에만 발생)
        // aiLoading, setAiLoading,
        setReportHTML,
        setCurrentPage, setErrorMessage, setReportCurrentPage
    } = useReportContext();
    
    // ⚠️ 4. AI 분석 및 리포트 생성 함수 (이제 async가 아니며, 매우 단순해짐)
    const renderReport = useCallback(() => {
        // setAiLoading(true); // ⚠️ 제거
        
        // 5. Context에서 이미 '모든 분석이 완료된' 데이터를 가져옴
        const currentData = testData[selectedClass]?.[selectedDate];
        if (!currentData) {
            setErrorMessage('리포트 데이터를 찾을 수 없습니다.');
            setCurrentPage('page4');
            // setAiLoading(false); // ⚠️ 제거
            return;
        }

        const student = selectedStudent ? currentData.studentData?.students?.find(s => s.name === selectedStudent) : null;
        if (selectedStudent && !student) {
            setErrorMessage(`학생 '${selectedStudent}' 데이터가 없습니다.`);
            setCurrentPage('page4');
            // setAiLoading(false); // ⚠️ 제거
            return;
        }

        // ⚠️ 6. [중요] '무한 루프'를 유발했던 AI 호출, DB 저장, 상태 업데이트 로직 '전부' 제거
        /*
        const skeletonHtml = ...
        setReportHTML(skeletonHtml);
        
        const analysisPromises = [];
        ...
        await Promise.all(analysisPromises);
        ...
        if (dataWasUpdated) {
             await saveDataToFirestore(newTestData);
             setTestData(newTestData);
        }
        */

        // ⚠️ 7. [치명적 오류 방지] 데이터가 분석되었는지 최종 확인
        // (이 데이터는 useFileProcessor가 만들었어야 함)
        if (!currentData.aiOverallAnalysis || !currentData.questionUnitMap) {
             setErrorMessage("데이터가 완전하지 않습니다. (공통 분석 누락) '처음으로' 돌아가 파일을 다시 업로드해주세요.");
             setCurrentPage('page4'); 
             return;
        }
         if (selectedStudent && student.submitted && !student.aiAnalysis) {
             setErrorMessage(`'${selectedStudent}' 학생의 AI 분석이 누락되었습니다. '처음으로' 돌아가 파일을 다시 업로드해주세요.`);
             setCurrentPage('page4'); 
             return;
        }

        // ⚠️ 8. '최종 HTML'을 '즉시' 생성
        // 데이터는 이미 완성되어 있으므로 'skeleton'이 아닌 'final' HTML을 바로 만듭니다.
        const finalHtml = selectedStudent ?
            generateIndividualReportHTML(student, currentData, student?.aiAnalysis, currentData.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(currentData, currentData.aiOverallAnalysis, selectedClass, selectedDate);

        setReportHTML(finalHtml); // ⭐️ AI 결과가 반영된 최종 HTML로 업데이트
        setReportCurrentPage(1);  // 리포트를 새로 열면 항상 1페이지부터
        // setAiLoading(false); // ⚠️ 제거
        
    }, [ 
        // ⚠️ 9. 의존성 배열 대폭 축소
        testData, selectedClass, selectedDate, selectedStudent, 
        setReportHTML, setErrorMessage, setCurrentPage, setReportCurrentPage
    ]);

    // ⭐️ 이 useEffect는 'renderReport'를 실행할 뿐,
    // 'renderReport' 자체가 더 이상 AI 호출이나 setTestData를 하지 않으므로
    // '무한 루프'가 절대 발생하지 않습니다.
    useEffect(() => {
        if (currentPage === 'page5') {
            renderReport();
        }
    }, [currentPage, renderReport]); // ⭐️ `renderReport`는 useCallback으로 감싸져 있으므로 안전합니다.

    // return { aiLoading }; // ⚠️ 제거
    return {}; // 이 훅은 이제 아무것도 반환할 필요가 없습니다.
};