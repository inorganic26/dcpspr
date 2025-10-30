import { useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';

export const useReportNavigation = () => {
    const { 
        currentPage, setCurrentPage, 
        setSelectedClass, setSelectedDate, setSelectedStudent 
    } = useReportContext();

    const goBack = useCallback(() => {
        // ⭐️⭐️⭐️ 변경된 부분 (페이지 순서) ⭐️⭐️⭐️
        if (currentPage === 'page5') {       // 리포트 -> 학생 선택
            setCurrentPage('page4');
            setSelectedStudent(null);
        } else if (currentPage === 'page4') { // 학생 선택 -> 반 선택
            setCurrentPage('page2');
            setSelectedClass('');
        } else if (currentPage === 'page2') { // 반 선택 -> 날짜 선택
            setCurrentPage('page3');
            setSelectedDate('');
        } else if (currentPage === 'page3') { // 날짜 선택 -> 파일 업로드
            setCurrentPage('page1');
        }
        // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
    }, [currentPage, setCurrentPage, setSelectedClass, setSelectedDate, setSelectedStudent]);

    const goHome = useCallback(() => {
        // ⭐️⭐️⭐️ 변경된 부분 ⭐️⭐️⭐️
        setCurrentPage('page1'); // ⭐️ 홈을 '파일 업로드'로 변경
        // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
        setSelectedClass('');
        setSelectedDate('');
        setSelectedStudent(null);
    }, [setCurrentPage, setSelectedClass, setSelectedDate, setSelectedStudent]);

    return { goBack, goHome, showPage: setCurrentPage };
};