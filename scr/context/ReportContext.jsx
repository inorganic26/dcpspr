// scr/context/ReportContext.jsx

import React, { createContext, useContext, useState } from 'react';

const ReportContext = createContext();

export const useReportContext = () => useContext(ReportContext);

export const ReportProvider = ({ children }) => {
    const [testData, setTestData] = useState({});
    const [currentPage, setCurrentPage] = useState('page1'); // page1 (upload), page2 (class), page3 (date), page4 (report), page5 (display)
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null); // null for overall, name for individual
    
    // --- Global Loading States ---
    const [initialLoading, setInitialLoading] = useState(true); // App.jsx에서 로그인 후 최초 데이터 로드
    const [processing, setProcessing] = useState(false); // useFileProcessor (파일 처리 중)
    
    // ⭐️ [수정] useChartAndPDF.js가 'aiLoading'을 사용하므로 이름을 통일합니다.
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

    // ⭐️ [추가] useChartAndPDF.js가 Context에서 사용하길 기대하는 차트 상태
    const [activeChart, setActiveChart] = useState(null);


    const showPage = (pageName) => {
        setErrorMessage(''); // 페이지 이동 시 항상 에러 메시지 초기화
        setCurrentPage(pageName);
    };

    const value = {
        testData, setTestData,
        currentPage, setCurrentPage, showPage,
        selectedClass, setSelectedClass,
        selectedDate, setSelectedDate,
        selectedStudent, setSelectedStudent,
        
        initialLoading, setInitialLoading,
        processing, setProcessing,
        
        // ⭐️ [수정] isIndividualLoading -> aiLoading으로 변경
        aiLoading, setAiLoading,

        reportHTML, setReportHTML,
        reportCurrentPage, setReportCurrentPage,

        errorMessage, setErrorMessage,
        currentTeacher, setCurrentTeacher,
        uploadDate, setUploadDate,
        
        // ⭐️ [추가] Context에 activeChart 상태 제공
        activeChart, setActiveChart
    };

    return (
        <ReportContext.Provider value={value}>
            {children}
        </ReportContext.Provider>
    );
};