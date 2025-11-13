// scr/hooks/useReportGenerator.js

import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { getAIAnalysis } from '../lib/ai.js';
import { generateOverallReportHTML, generateIndividualReportHTML } from '../lib/reportUtils.js';
import { updateStudentAnalysis } from './useFirebase';

export const useReportGenerator = () => {
    const { 
        currentReportData, setCurrentReportData,
        
        currentPage, 
        selectedReportId, selectedClass, selectedDate, selectedStudent,
        
        aiLoading, setAiLoading,

        setReportHTML,
        setCurrentPage, setErrorMessage, setReportCurrentPage
    } = useReportContext();
    
    const renderReport = useCallback(async () => {
        
        const currentData = currentReportData;
        if (!currentData) {
            setErrorMessage('리포트 데이터를 찾을 수 없습니다.');
            setCurrentPage('page4');
            return;
        }

        const student = selectedStudent ? currentData.students?.find(s => s.name === selectedStudent) : null;
        if (selectedStudent && !student) {
            setErrorMessage(`학생 '${selectedStudent}' 데이터가 없습니다.`);
            setCurrentPage('page4');
            return;
        }
        
        // --- ⭐️ [수정] 개별 학생 분석 On-Demand 로직 (AI 호출 수정) ---
        if (selectedStudent) {
            if (student.submitted && !student.aiAnalysis && !aiLoading) {
                
                setAiLoading(true); 
                setReportHTML(`<div class="card p-8 text-center mt-10"><div class="spinner mx-auto"></div><p class="mt-4 text-gray-600">AI가 ${student.name} 학생의 개별 리포트를 생성 중입니다...</p></div>`);
                
                try {
                    console.log(`[AI Analysis] '${student.name}' 학생 분석 시작...`);
                    // ⭐️ [수정] 'getAIAnalysis'는 이제 (Pro Vision이 만든) 마스터 분석표를 받음
                    const analysis = await getAIAnalysis(
                        student, 
                        currentData, // (반 평균 등 통계)
                        currentData.questionUnitMap // ⭐️ (Pro Vision 마스터 분석표)
                    );
                    console.log(`[AI Analysis] '${student.name}' 학생 분석 완료.`);

                    // 4. [DB 저장] 
                    await updateStudentAnalysis(selectedReportId, student.name, analysis);
                    console.log(`[Firestore] '${student.name}' 학생 분석 결과 저장 완료.`);

                    // 6. [로컬 상태 저장]
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
         const studentForReport = currentData.students?.find(s => s.name === selectedStudent);
         if (selectedStudent && studentForReport?.submitted && !studentForReport?.aiAnalysis) {
             setErrorMessage(`'${selectedStudent}' 학생의 AI 분석이 아직 완료되지 않았습니다. 잠시 후 다시 시도해주세요.`);
             return;
        }

        // 12. '최종 HTML'을 생성
        const finalHtml = selectedStudent ?
            // ⭐️ [수정] generateIndividualReportHTML에 aiAnalysis(Flash 요약)와 questionUnitMap(Pro 분석표)을 모두 전달
            generateIndividualReportHTML(studentForReport, currentData, studentForReport?.aiAnalysis, currentData.aiOverallAnalysis, selectedClass, selectedDate) :
            generateOverallReportHTML(currentData, currentData.aiOverallAnalysis, selectedClass, selectedDate);

        setReportHTML(finalHtml);
        setReportCurrentPage(1);
        
    }, [ 
        currentReportData, selectedClass, selectedDate, selectedStudent, selectedReportId,
        aiLoading, setAiLoading,
        setReportHTML, setErrorMessage, setCurrentPage, setReportCurrentPage,
        setCurrentReportData
    ]);

    useEffect(() => {
        if (currentPage === 'page5') {
            renderReport();
        }
    }, [currentPage, renderReport]); 

    return {};
};