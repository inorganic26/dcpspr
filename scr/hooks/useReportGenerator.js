// scr/hooks/useReportGenerator.js

import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { getAIAnalysis } from '../lib/ai.js';
import { generateOverallReportHTML, generateIndividualReportHTML } from '../lib/reportUtils.js';
// ⭐️ [신규] 'updateStudentAnalysis' 임포트
import { updateStudentAnalysis } from './useFirebase';

// ⭐️ [수정] App.jsx에서 더 이상 props를 받지 않습니다.
export const useReportGenerator = (/* { saveDataToFirestore, setTestData } 제거 */) => {
    const { 
        // ⭐️ [수정] testData -> currentReportData
        currentReportData, setCurrentReportData,
        
        currentPage, 
        // ⭐️ [수정] selectedReportId 추가
        selectedReportId, selectedClass, selectedDate, selectedStudent,
        
        aiLoading, setAiLoading,

        setReportHTML,
        setCurrentPage, setErrorMessage, setReportCurrentPage
    } = useReportContext();
    
    const renderReport = useCallback(async () => {
        
        // ⭐️ [수정] 데이터 참조 변경
        const currentData = currentReportData;
        if (!currentData) {
            // (App.jsx의 로직 변경으로 이 오류는 거의 발생하지 않아야 함)
            setErrorMessage('리포트 데이터를 찾을 수 없습니다.');
            setCurrentPage('page4');
            return;
        }

        // ⭐️ [수정] 학생 데이터 참조 변경 (currentData.students)
        const student = selectedStudent ? currentData.students?.find(s => s.name === selectedStudent) : null;
        if (selectedStudent && !student) {
            setErrorMessage(`학생 '${selectedStudent}' 데이터가 없습니다.`);
            setCurrentPage('page4');
            return;
        }
        
        // --- ⭐️ 5. [핵심] 개별 학생 분석 On-Demand 로직 (수정됨) ---
        if (selectedStudent) {
            if (student.submitted && !student.aiAnalysis && !aiLoading) {
                
                setAiLoading(true); 
                setReportHTML(`<div class="card p-8 text-center mt-10"><div class="spinner mx-auto"></div><p class="mt-4 text-gray-600">AI가 ${student.name} 학생의 개별 리포트를 생성 중입니다...</p></div>`);
                
                try {
                    console.log(`[AI Analysis] '${student.name}' 학생 분석 시작...`);
                    // ⭐️ [수정] 'currentData'가 이제 공통 데이터 + students 배열을 가짐
                    const analysis = await getAIAnalysis(
                        student, 
                        currentData, // (공통 통계 포함)
                        selectedClass, 
                        currentData.questionUnitMap
                    );
                    console.log(`[AI Analysis] '${student.name}' 학생 분석 완료.`);

                    // 4. [DB 저장] ⭐️⭐️⭐️ (핵심 변경) ⭐️⭐️⭐️
                    // '전체 덮어쓰기' 대신 '개별 업데이트' 호출
                    await updateStudentAnalysis(selectedReportId, student.name, analysis);
                    console.log(`[Firestore] '${student.name}' 학생 분석 결과 저장 완료.`);


                    // 6. [로컬 상태 저장] ⭐️ (수정) ⭐️
                    // 'testData' 전체가 아닌 'currentReportData'의 학생만 업데이트
                    setCurrentReportData(prevData => {
                        const newStudents = prevData.students.map(s =>
                            s.name === student.name ? { ...s, aiAnalysis: analysis } : s
                        );
                        return { ...prevData, students: newStudents };
                    });
                    
                } catch (error) {
                    console.error("Individual analysis failed:", error);
                    setErrorMessage(`'${student.name}' 학생 분석 중 오류: ${error.message}`);
                    setCurrentPage('page4'); 
                    setAiLoading(false); 
                } finally {
                    setTimeout(() => setAiLoading(false), 0); 
                }
                
                return; 

            } else if (aiLoading) { 
                setReportHTML(`<div class="card p-8 text-center mt-10"><div class="spinner mx-auto"></div><p class="mt-4 text-gray-600">AI가 ${student.name} 학생의 개별 리포트를 생성 중입니다...</p></div>`);
                return;
            }
        }
        // --- On-Demand 로직 끝 ---


        // 11. [데이터 완전성 검사]
        if (!currentData.aiOverallAnalysis || !currentData.questionUnitMap) {
             setErrorMessage("데이터가 완전하지 않습니다. (공통 분석 누락) '처음으로' 돌아가 파일을 다시 업로드해주세요.");
             setCurrentPage('page4'); 
             return;
        }
         // ⭐️ [수정] 학생 데이터 참조 변경
         const studentForReport = currentData.students?.find(s => s.name === selectedStudent);
         if (selectedStudent && studentForReport?.submitted && !studentForReport?.aiAnalysis) {
             setErrorMessage(`'${selectedStudent}' 학생의 AI 분석이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.`);
             return;
        }

        // 12. '최종 HTML'을 생성
        // ⭐️ [수정] 학생 객체를 'studentForReport'로 명확히 전달
        // ⭐️ [수정] 'currentData.studentData' 대신 'currentData' (통계) 전달
        const finalHtml = selectedStudent ?
            generateIndividualReportHTML(studentForReport, currentData, studentForReport?.aiAnalysis, currentData.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(currentData, currentData.aiOverallAnalysis, selectedClass, selectedDate);

        setReportHTML(finalHtml);
        setReportCurrentPage(1);
        
    }, [ 
        // ⭐️ 13. [수정] 의존성 배열 수정
        currentReportData, selectedClass, selectedDate, selectedStudent, selectedReportId,
        aiLoading, setAiLoading,
        setReportHTML, setErrorMessage, setCurrentPage, setReportCurrentPage,
        setCurrentReportData
        // (saveDataToFirestore, setTestData 제거)
    ]);

    useEffect(() => {
        if (currentPage === 'page5') {
            renderReport();
        }
    }, [currentPage, renderReport]); 

    return {};
};