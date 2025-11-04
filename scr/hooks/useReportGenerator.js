// scr/hooks/useReportGenerator.js

import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
// ⭐️ 1. [추가] 개별 학생 분석 함수 임포트
import { getAIAnalysis } from '../lib/ai.js';
import { generateOverallReportHTML, generateIndividualReportHTML } from '../lib/reportUtils.js';

// ⭐️ 2. [수정] App.jsx에서 전달받을 props 정의
export const useReportGenerator = ({ saveDataToFirestore, setTestData }) => {
    const { 
        testData,
        currentPage, 
        selectedClass, selectedDate, selectedStudent,
        
        // ⭐️ 3. [추가] 개별 학생 로딩 상태
        isIndividualLoading, setIsIndividualLoading,

        setReportHTML,
        setCurrentPage, setErrorMessage, setReportCurrentPage
    } = useReportContext();
    
    // ⭐️ 4. [수정] 리포트 생성/조회 함수 (On-Demand 로직 추가)
    const renderReport = useCallback(async () => {
        
        const currentData = testData[selectedClass]?.[selectedDate];
        if (!currentData) {
            setErrorMessage('리포트 데이터를 찾을 수 없습니다.');
            setCurrentPage('page4');
            return;
        }

        const student = selectedStudent ? currentData.studentData?.students?.find(s => s.name === selectedStudent) : null;
        if (selectedStudent && !student) {
            setErrorMessage(`학생 '${selectedStudent}' 데이터가 없습니다.`);
            setCurrentPage('page4');
            return;
        }
        
        // --- ⭐️ 5. [핵심] 개별 학생 분석 On-Demand 로직 ---
        if (selectedStudent) {
            // 학생이 시험을 제출했고, AI 분석 결과(aiAnalysis)가 아직 없으며, 현재 로딩 중이 아닐 때
            if (student.submitted && !student.aiAnalysis && !isIndividualLoading) {
                
                // 1. 개별 분석 시작: 로딩 상태 켜기
                setIsIndividualLoading(true);
                // 2. 리포트 영역에 로딩 스피너 표시
                setReportHTML(`<div class="card p-8 text-center mt-10"><div class="spinner mx-auto"></div><p class="mt-4 text-gray-600">AI가 ${student.name} 학생의 개별 리포트를 생성 중입니다...</p></div>`);
                
                try {
                    // 3. [API 호출] 해당 학생의 분석만 요청
                    console.log(`[AI Analysis] '${student.name}' 학생 분석 시작...`);
                    const analysis = await getAIAnalysis(student, currentData, selectedClass, currentData.questionUnitMap);
                    console.log(`[AI Analysis] '${student.name}' 학생 분석 완료.`);

                    // 4. [상태 업데이트] 기존 testData를 깊은 복사하여 업데이트
                    const newTestData = JSON.parse(JSON.stringify(testData));
                    
                    const studentToUpdate = newTestData[selectedClass][selectedDate].studentData.students.find(s => s.name === student.name);
                    
                    if (studentToUpdate) {
                         studentToUpdate.aiAnalysis = analysis; // 분석 결과 저장
                    } else {
                        throw new Error("데이터 복사 후 학생 객체를 찾는 데 실패했습니다.");
                    }

                    // 5. [DB 저장] 업데이트된 전체 testData를 Firestore에 '공용' 데이터로 저장
                    // ★ 중요: Firestore 저장은 백그라운드에서 실행하고 UI는 즉시 업데이트
                    saveDataToFirestore(newTestData).then(() => {
                        console.log(`[Firestore] '${student.name}' 학생 분석 결과 저장 완료.`);
                    }).catch(err => {
                        console.error("[Firestore] 학생 분석 결과 저장 실패:", err);
                        // UI에 치명적인 에러를 보낼 필요는 없음 (다음 로드 시 다시 분석)
                    });

                    // 6. [로컬 상태 저장] 로컬 상태를 업데이트 -> 리렌더링 발생
                    setTestData(newTestData);
                    
                    // setTestData()가 실행되면 이 컴포넌트가 리렌더링되고,
                    // useEffect가 다시 실행되어 renderReport()가 '한 번 더' 호출됩니다.
                    // '다음' 호출 시에는 isIndividualLoading=true 상태이므로,
                    // else if (isIndividualLoading) 블록으로 이동합니다.
                    // AI 호출이 완료되고 finally에서 setIsIndividualLoading(false)가 실행되면
                    // 그 다음 리렌더링에서 student.aiAnalysis가 존재하므로 최종 HTML이 생성됩니다.
                    // (무한 루프가 아님)

                } catch (error) {
                    console.error("Individual analysis failed:", error);
                    setErrorMessage(`'${student.name}' 학생 분석 중 오류: ${error.message}`);
                    setCurrentPage('page4'); // 오류 시 이전 페이지로
                    setIsIndividualLoading(false); // ⭐️ 오류 시 로딩 상태 해제
                } finally {
                    // 7. 로딩 상태 끄기 (성공/실패 여부와 관계없이)
                    // ⭐️ setTestData가 리렌더링을 유발하므로, 다음 렌더링 사이클에서 false가 되도록 함
                    setTimeout(() => setIsIndividualLoading(false), 0);
                }
                
                // 8. 이번 렌더링은 로딩 화면 표시까지만 하고 종료
                return; 

            } else if (isIndividualLoading) {
                // 9. 이미 로딩이 진행 중인 경우 (setTestData 직후 리렌더링)
                //    -> 다시 로딩 스피너를 표시하고 종료 (AI 호출 중복 방지)
                setReportHTML(`<div class="card p-8 text-center mt-10"><div class="spinner mx-auto"></div><p class="mt-4 text-gray-600">AI가 ${student.name} 학생의 개별 리포트를 생성 중입니다...</p></div>`);
                return;
            }
            // 10. (else) 학생이 미제출했거나, aiAnalysis가 이미 존재하면 -> 통과
        }
        // --- On-Demand 로직 끝 ---


        // 11. [데이터 완전성 검사] 공통 분석 데이터 확인
        if (!currentData.aiOverallAnalysis || !currentData.questionUnitMap) {
             setErrorMessage("데이터가 완전하지 않습니다. (공통 분석 누락) '처음으로' 돌아가 파일을 다시 업로드해주세요.");
             setCurrentPage('page4'); 
             return;
        }
         if (selectedStudent && student.submitted && !student.aiAnalysis) {
             // ⭐️ 이 시점은 로딩이 끝났는데도 aiAnalysis가 없는 경우 (예: AI 분석 실패 후)
             setErrorMessage(`'${selectedStudent}' 학생의 AI 분석이 아직 완료되지 않았습니다. 페이지를 새로고침하거나 다시 시도해주세요.`);
             return;
        }

        // 12. '최종 HTML'을 생성
        const finalHtml = selectedStudent ?
            generateIndividualReportHTML(student, currentData, student?.aiAnalysis, currentData.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(currentData, currentData.aiOverallAnalysis, selectedClass, selectedDate);

        setReportHTML(finalHtml);
        setReportCurrentPage(1);
        
    }, [ 
        // ⭐️ 13. [수정] 의존성 배열에 필요한 모든 항목 추가
        testData, selectedClass, selectedDate, selectedStudent, 
        isIndividualLoading, setIsIndividualLoading,
        setReportHTML, setErrorMessage, setCurrentPage, setReportCurrentPage,
        saveDataToFirestore, setTestData
    ]);

    useEffect(() => {
        if (currentPage === 'page5') {
            renderReport();
        }
    }, [currentPage, renderReport]); // `renderReport`는 useCallback으로 감싸져 있으므로 안전합니다.

    return {};
};