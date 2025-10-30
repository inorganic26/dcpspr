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
    
    // 리포트/차트 상태
    const [reportHTML, setReportHTML] = useState('');
    const [activeChart, setActiveChart] = useState(null);
    const [reportCurrentPage, setReportCurrentPage] = useState(1);

    const showPage = (page) => setCurrentPage(page);

    // ⭐️⭐️⭐️ 변경된 부분 ⭐️⭐️⭐️
    // useMemo의 의존성 배열에서 모든 set- 함수들을 제거합니다.
    const value = useMemo(() => ({
        testData, setTestData,
        currentPage, setCurrentPage, showPage,
        uploadDate, setUploadDate,
        selectedClass, setSelectedClass,
        selectedDate, setSelectedDate,
        selectedStudent, setSelectedStudent,
        errorMessage, setErrorMessage,
        initialLoading, setInitialLoading,
        processing, setProcessing,
        aiLoading, setAiLoading,
        reportHTML, setReportHTML,
        activeChart, setActiveChart,
        reportCurrentPage, setReportCurrentPage
    }), [
        testData, currentPage, uploadDate, selectedClass, 
        selectedDate, selectedStudent, errorMessage,
        initialLoading, processing, aiLoading,
        reportHTML, activeChart, reportCurrentPage
    ]);
    // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️

    return (
        <ReportContext.Provider value={value}>
            {children}
        </ReportContext.Provider>
    );
};