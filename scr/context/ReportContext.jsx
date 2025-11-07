// scr/context/ReportContext.jsx

import React, { createContext, useContext, useState } from 'react';

const ReportContext = createContext();

export const useReportContext = () => useContext(ReportContext);

export const ReportProvider = ({ children }) => {
    // ⭐️ [수정] 'testData'를 'currentReportData'로 변경 (현재 선택된 리포트 상세)
    const [currentReportData, setCurrentReportData] = useState(null); 
    // ⭐️ [신규] 'reportSummaries' 추가 (모든 리포트의 요약 목록)
    const [reportSummaries, setReportSummaries] = useState([]);
    
    const [currentPage, setCurrentPage] = useState('page1'); // page1, page2, page3, page4, page5
    
    // ⭐️ [수정] 'selectedReportId' 추가 (DB의 문서 ID)
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null); // null for overall, name for individual
    
    // --- Global Loading States ---
    const [initialLoading, setInitialLoading] = useState(true); // App.jsx에서 로그인 후 최초 데이터 로드
    const [processing, setProcessing] = useState(false); // useFileProcessor (파일 처리 중)
    const [aiLoading, setAiLoading] = useState(false); 

    // --- Report Display States ---
    const [reportHTML, setReportHTML] = useState('');
    const [reportCurrentPage, setReportCurrentPage] = useState(1);

    // --- Error States ---
    const [errorMessage, setErrorMessage] = useState(''); // Page1 (파일 업로드) 용
    
    // --- Auth State ---
    const [currentTeacher, setCurrentTeacher] = useState(null); // null, or { name: "...", phone: "..." }

    // --- Other ---
    const [uploadDate, setUploadDate] = useState('');
    const [activeChart, setActiveChart] = useState(null);


    const showPage = (pageName) => {
        setErrorMessage(''); // 페이지 이동 시 항상 에러 메시지 초기화
        setCurrentPage(pageName);
    };
    
    // ⭐️ [신규] 홈으로 갈 때 모든 선택 초기화
    const resetSelections = () => {
        setSelectedReportId(null);
        setSelectedClass(null);
        setSelectedDate(null);
        setSelectedStudent(null);
        setCurrentReportData(null);
        setReportHTML('');
    };

    const value = {
        // ⭐️ [수정] 데이터 상태 변경
        reportSummaries, setReportSummaries,
        currentReportData, setCurrentReportData,
        
        // ⭐️ [수정] testData, setTestData 제거
        // testData: currentReportData, // (하위 호환성을 위해 임시 제공)
        // setTestData: setCurrentReportData,
        
        currentPage, setCurrentPage, showPage, resetSelections,
        
        // ⭐️ [수정] 선택 상태 변경
        selectedReportId, setSelectedReportId,
        selectedClass, setSelectedClass,
        selectedDate, setSelectedDate,
        selectedStudent, setSelectedStudent,
        
        initialLoading, setInitialLoading,
        processing, setProcessing,
        aiLoading, setAiLoading,

        reportHTML, setReportHTML,
        reportCurrentPage, setReportCurrentPage,

        errorMessage, setErrorMessage,
        currentTeacher, setCurrentTeacher,
        uploadDate, setUploadDate,
        
        activeChart, setActiveChart
    };

    return (
        <ReportContext.Provider value={value}>
            {children}
        </ReportContext.Provider>
    );
};