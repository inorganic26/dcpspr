// scr/context/ReportContext.jsx

import React, { createContext, useState, useContext, useMemo } from 'react';

const ReportContext = createContext();

export const useReportContext = () => useContext(ReportContext);

export const ReportProvider = ({ children }) => {
    // App.jsx에 있던 모든 useState를 이곳으로 이동
    const [testData, setTestData] = useState({});
    const [currentPage, setCurrentPage] = useState('page1');
    const [uploadDate, setUploadDate] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null);

    // UI 상태
    const [initialLoading, setInitialLoading] = useState(true);
    const [processing, setProcessing] = useState(false); 
    const [aiLoading, setAiLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    
    // ⭐️⭐️⭐️ [추가된 부분] ⭐️⭐️⭐️
    // App.jsx와 useFirebase.js에서 사용할 인증 오류 상태
    const [authError, setAuthError] = useState(null); 
    // ⭐️⭐️⭐️ [추가 완료] ⭐️⭐️⭐️

    // 리포트/차트 상태
    const [reportHTML, setReportHTML] = useState('');
    const [activeChart, setActiveChart] = useState(null);
    const [reportCurrentPage, setReportCurrentPage] = useState(1);

    const showPage = (page) => setCurrentPage(page);

    const value = useMemo(() => ({
        testData, setTestData,
        currentPage, setCurrentPage, showPage,
        uploadDate, setUploadDate,
        selectedClass, setSelectedClass,
        selectedDate, setSelectedDate,
        selectedStudent, setSelectedStudent,
        errorMessage, setErrorMessage,
        
        // ⭐️⭐️⭐️ [추가된 부분] ⭐️⭐️⭐️
        authError, setAuthError,
        // ⭐️⭐️⭐️ [추가 완료] ⭐️⭐️⭐️
        
        initialLoading, setInitialLoading,
        processing, setProcessing,
        aiLoading, setAiLoading,
        reportHTML, setReportHTML,
        activeChart, setActiveChart,
        reportCurrentPage, setReportCurrentPage
    }), [
        testData, currentPage, uploadDate, selectedClass, 
        selectedDate, selectedStudent, errorMessage,
        
        // ⭐️⭐️⭐️ [추가된 부분] ⭐️⭐️⭐️
        authError, 
        // ⭐️⭐️⭐️ [추가 완료] ⭐️⭐️⭐️
        
        initialLoading, processing, aiLoading,
        reportHTML, activeChart, reportCurrentPage
    ]);

    return (
        <ReportContext.Provider value={value}>
            {children}
        </ReportContext.Provider>
    );
};