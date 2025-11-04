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
        
        // ⭐️ 3. [수정] isIndividualLoading -> aiLoading 으로 변경
        aiLoading, setAiLoading,

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
            // ⭐️ [수정] aiLoading 으로 체크
            if (student.submitted && !student.aiAnalysis && !aiLoading) {
                
                // 1. 개별 분석 시작: 로딩 상태 켜기
                setAiLoading(true); // ⭐️ [수정]
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
                    saveDataToFirestore(newTestData).then(() => {
                        console.log(`[Firestore] '${student.name}' 학생 분석 결과 저장 완료.`);
                    }).catch(err => {
                        console.error("[Firestore] 학생 분석 결과 저장 실패:", err);
                    });

                    // 6. [로컬 상태 저장] 로컬 상태를 업데이트 -> 리렌더링 발생
                    setTestData(newTestData);
                    
                } catch (error) {
                    console.error("Individual analysis failed:", error);
                    setErrorMessage(`'${student.name}' 학생 분석 중 오류: ${error.message}`);
                    setCurrentPage('page4'); // 오류 시 이전 페이지로
                    setAiLoading(false); // ⭐️ [수정] 오류 시 로딩 상태 해제
                } finally {
                    // 7. 로딩 상태 끄기 (성공/실패 여부와 관계없이)
                    setTimeout(() => setAiLoading(false), 0); // ⭐️ [수정]
                }
                
                // 8. 이번 렌더링은 로딩 화면 표시까지만 하고 종료
                return; 

            } else if (aiLoading) { // ⭐️ [수정]
                // 9. 이미 로딩이 진행 중인 경우 (setTestData 직후 리렌더링)
                setReportHTML(`<div class="card p-8 text-center mt-10"><div class="spinner mx-auto"></div><p class="mt-4 text-gray-600">AI가 ${student.name} 학생의 개별 리포트를 생성 중입니다...</p></div>`);
                return;
            }
        }
        // --- On-Demand 로직 끝 ---


        // 11. [데이터 완전성 검사] 공통 분석 데이터 확인
        if (!currentData.aiOverallAnalysis || !currentData.questionUnitMap) {
             setErrorMessage("데이터가 완전하지 않습니다. (공통 분석 누락) '처음으로' 돌아가 파일을 다시 업로드해주세요.");
             setCurrentPage('page4'); 
             return;
        }
         if (selectedStudent && student.submitted && !student.aiAnalysis) {
             setErrorMessage(`'${selectedStudent}' 학생의 AI 분석이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.`);
             return;
        }

        // 12. '최종 HTML'을 생성
        const finalHtml = selectedStudent ?
            generateIndividualReportHTML(student, currentData, student?.aiAnalysis, currentData.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(currentData, currentData.aiOverallAnalysis, selectedClass, selectedDate);

        setReportHTML(finalHtml);
        setReportCurrentPage(1);
        
    }, [ 
        // ⭐️ 13. [수정] 의존성 배열 수정
        testData, selectedClass, selectedDate, selectedStudent, 
        aiLoading, setAiLoading,
        setReportHTML, setErrorMessage, setCurrentPage, setReportCurrentPage,
        saveDataToFirestore, setTestData
    ]);

    useEffect(() => {
        if (currentPage === 'page5') {
            renderReport();
        }
    }, [currentPage, renderReport]); 

    return {};
};