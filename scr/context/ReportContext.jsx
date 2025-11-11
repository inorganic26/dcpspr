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
    
    // ⭐️ [제거] 과목 목록 상태
    // const [subjects, setSubjects] = useState([]);

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

        selectedFiles, setSelectedFiles
        
        // ⭐️ [제거] Context에서 'subjects' 제공 제거
    };

    return (
        <ReportContext.Provider value={value}>
            {children}
        </ReportContext.Provider>
    );
};