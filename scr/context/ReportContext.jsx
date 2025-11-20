// scr/context/ReportContext.jsx

import React, { createContext, useContext, useState } from 'react';

const ReportContext = createContext();

export const useReportContext = () => useContext(ReportContext);

export const ReportProvider = ({ children }) => {
    const [currentReportData, setCurrentReportData] = useState(null); 
    const [reportSummaries, setReportSummaries] = useState([]);
    
    const [currentPage, setCurrentPage] = useState('page1'); 
    
    const [selectedReportId, setSelectedReportId] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null); 
    
    const [initialLoading, setInitialLoading] = useState(true); 
    const [processing, setProcessing] = useState(false); 
    const [aiLoading, setAiLoading] = useState(false); 

    const [reportHTML, setReportHTML] = useState('');
    const [reportCurrentPage, setReportCurrentPage] = useState(1);

    const [errorMessage, setErrorMessage] = useState(''); 
    
    const [currentTeacher, setCurrentTeacher] = useState(null); 

    const [uploadDate, setUploadDate] = useState('');
    const [activeChart, setActiveChart] = useState(null);

    const [selectedFiles, setSelectedFiles] = useState([]);

    // ⭐️ [신규] 누적 분석을 위한 상태 추가
    const [cumulativeData, setCumulativeData] = useState(null); 
    const [selectedDates, setSelectedDates] = useState([]); // 다중 날짜 선택용

    const showPage = (pageName) => {
        setErrorMessage(''); 
        setCurrentPage(pageName);
    };
    
    const resetSelections = () => {
        setSelectedReportId(null);
        setSelectedClass(null);
        setSelectedDate(null);
        setSelectedStudent(null);
        setCurrentReportData(null);
        setReportHTML('');
        
        // ⭐️ 누적 분석 상태 초기화
        setCumulativeData(null);
        setSelectedDates([]);
    };

    const value = {
        reportSummaries, setReportSummaries,
        currentReportData, setCurrentReportData,
        
        currentPage, setCurrentPage, showPage, resetSelections,
        
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
        
        activeChart, setActiveChart,

        selectedFiles, setSelectedFiles,

        // ⭐️ [신규] 누적 분석 상태 제공
        cumulativeData, setCumulativeData,
        selectedDates, setSelectedDates
    };

    return (
        <ReportContext.Provider value={value}>
            {children}
        </ReportContext.Provider>
    );
};