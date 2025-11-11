// scr/hooks/useReportNavigation.js

import { useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';

export const useReportNavigation = () => {
    const { 
        currentPage, showPage, 
        setSelectedClass, setSelectedDate, setSelectedStudent 
    } = useReportContext();

    const goBack = useCallback(() => {
        // ⭐️ [수정] 'page6' 케이스 제거
        if (currentPage === 'page5') {       // 리포트 -> 학생 선택
            showPage('page4');
            setSelectedStudent(null);
        } else if (currentPage === 'page4') { // 학생 선택 -> 반 선택
            showPage('page2');
            setSelectedClass('');
        } else if (currentPage === 'page2') { // 반 선택 -> 날짜 선택
            showPage('page3');
            setSelectedDate('');
        } else if (currentPage === 'page3') { // 날짜 선택 -> 파일 업로드
            showPage('page1');
        }
    }, [currentPage, showPage, setSelectedClass, setSelectedDate, setSelectedStudent]);

    const goHome = useCallback(() => {
        showPage('page1'); 
        setSelectedClass('');
        setSelectedDate('');
        setSelectedStudent(null);
    }, [showPage, setSelectedClass, setSelectedDate, setSelectedStudent]);

    return { goBack, goHome, showPage }; 
};