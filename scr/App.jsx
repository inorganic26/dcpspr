// scr/App.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useReportContext } from './context/ReportContext';
import { 
    loginTeacher, registerTeacher, 
    loadReportSummaries, loadReportDetails, 
    deleteReport, deleteStudentFromReport,
    addStudentToReport
} from './hooks/useFirebase';
import { processStudentData } from './lib/fileParser'; 

import { useFileProcessor } from './hooks/useFileProcessor';
import { useReportGenerator } from './hooks/useReportGenerator';
import { useChartAndPDF } from './hooks/useChartAndPDF';
import { useReportNavigation } from './hooks/useReportNavigation';

import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebaseConfig'; 

import { Home, ArrowLeft, FileText, TriangleAlert, LogOut, User } from 'lucide-react';

import 'katex/dist/katex.min.css';

// ⭐️ [수정] 분리된 페이지 컴포넌트들을 임포트합니다.
import LoginPage from './pages/LoginPage';
import Page1_Upload from './pages/Page1_Upload';
import Page2_ClassSelect from './pages/Page2_ClassSelect';
import Page3_DateSelect from './pages/Page3_DateSelect';
import Page4_ReportSelect from './pages/Page4_ReportSelect';
import Page5_ReportDisplay from './pages/Page5_ReportDisplay';

import Page_Cumulative_Landing from './pages/Cumulative/Page_Cumulative_Landing';
import Page_Cumulative_DateSelect from './pages/Cumulative/Page_Cumulative_DateSelect';
import Page_Cumulative_Result from './pages/Cumulative/Page_Cumulative_Result';


// --- 5. 메인 App 컴포넌트 ---
const App = () => {
    const {
        currentPage, selectedClass, selectedDate, selectedStudent,
        initialLoading, setInitialLoading,
        errorMessage, setErrorMessage,
        currentTeacher, setCurrentTeacher,
        
        reportSummaries, setReportSummaries,
        setCurrentReportData,
        selectedReportId, setSelectedReportId,
        
        showPage, resetSelections,
        
        selectedFiles
        
    } = useReportContext();
    
    const [isAuthenticating, setIsAuthenticating] = useState(true); 
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');

    // ⭐️ [수정] Page1_Upload에 필요한 훅들을 App.jsx 레벨에서 유지하고 props로 전달합니다.
    const { fileInputRef, handleFileChange, handleFileProcess, handleFileDrop } = useFileProcessor();
    const { goBack, goHome } = useReportNavigation();
    
    useReportGenerator(); 
    const { handlePdfSave } = useChartAndPDF(); 
    
    useEffect(() => {
        const authenticate = async () => {
            try {
                if (!auth.currentUser) { 
                    await signInAnonymously(auth);
                }
                setIsAuthenticating(false); 
            } catch (error) {
                setLoginError("Firebase 인증에 실패했습니다. " + error.message);
                setIsAuthenticating(false); 
            }
        };
        authenticate();
    }, []); 

    const handleLogin = async (name, phone) => {
        setIsLoggingIn(true);
        setLoginError('');
        try {
            const teacher = await loginTeacher(name, phone);
            if (!teacher) {
                setLoginError('일치하는 선생님 정보가 없습니다. 등록하거나 정보를 확인해주세요.');
                setIsLoggingIn(false);
            } else {
                await performSuccessfulLogin(teacher);
            }
        } catch (error) {
            setLoginError(error.message);
            setIsLoggingIn(false);
        }
    };
    const handleRegister = async (name, phone) => {
        setIsLoggingIn(true);
        setLoginError('');
        try {
            const newTeacher = await registerTeacher(name, phone);
            alert('등록이 완료되었습니다. 자동으로 로그인합니다.');
            await performSuccessfulLogin(newTeacher);
        } catch (error) {
            setLoginError(error.message);
            setIsLoggingIn(false);
        }
    };
    
    const performSuccessfulLogin = async (teacher) => {
        setCurrentTeacher(teacher); 
        setInitialLoading(true); 
        
        try {
            const loadedSummaries = await loadReportSummaries();
            setReportSummaries(loadedSummaries || []); 
        } catch (error) {
            console.error("데이터 요약 로드 실패:", error);
            setLoginError("로그인은 성공했으나 데이터 로드에 실패했습니다: " + error.message);
            setReportSummaries([]); 
        } finally {
            setInitialLoading(false); 
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        setCurrentTeacher(null);
        setReportSummaries([]); 
        resetSelections(); 
        showPage('page1');
        setErrorMessage('');
    };
    
    const loadAndShowReport = useCallback(async (reportId, pageToShow) => {
        if (!reportId) return;
        setInitialLoading(true);
        try {
            const details = await loadReportDetails(reportId);
            setCurrentReportData(details);
            showPage(pageToShow);
        } catch (error) {
            setErrorMessage("리포트 상세 내역 로드 실패: " + error.message);
            showPage('page3'); 
        } finally {
            setInitialLoading(false);
        }
    }, [setCurrentReportData, setInitialLoading, setErrorMessage, showPage]);

    
    const handleDeleteDate = async (dateToDelete) => {
        if (!window.confirm(`'${dateToDelete}'의 모든 분석 데이터를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        setErrorMessage('삭제 중...'); 
        setInitialLoading(true); 
        const reportsToDelete = reportSummaries.filter(r => r.date === dateToDelete);
        try {
            await Promise.all(reportsToDelete.map(report => deleteReport(report.id)));
            setReportSummaries(prev => prev.filter(r => r.date !== dateToDelete));
            setErrorMessage(''); 
        } catch (error) {
            console.error("데이터 삭제 실패:", error);
            setErrorMessage("데이터 삭제 중 오류가 발생했습니다: " + error.message);
        } finally {
            setInitialLoading(false); 
        }
    };
    const handleDeleteClass = async (reportId, className, date) => {
        if (!window.confirm(`'${date}'의 '${className}'반 데이터를 정말 삭제하시겠습니까?`)) {
            return;
        }
        setInitialLoading(true); 
        try {
            await deleteReport(reportId);
            setReportSummaries(prev => prev.filter(r => r.id !== reportId));
        } catch (error) {
            setErrorMessage("반 데이터 삭제 중 오류: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleDeleteStudent = async (studentName, className, date) => {
        if (!window.confirm(`'${date}' - '${className}'반의 '${studentName}' 학생 데이터를 정말 삭제하시겠습니까?`)) {
            return;
        }
        if (!selectedReportId) {
            setErrorMessage("오류: 리포트 ID가 선택되지 않았습니다.");
            return;
        }
        
        setInitialLoading(true); 
        try {
            const newStats = await deleteStudentFromReport(selectedReportId, studentName);
            
            setCurrentReportData(prev => ({
                ...prev,
                students: prev.students.filter(s => s.name !== studentName),
                studentCount: newStats.studentCount,
                classAverage: newStats.classAverage,
                answerRates: newStats.answerRates
            }));
            
        } catch (error) {
            setErrorMessage("학생 데이터 삭제 중 오류: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    };
    
    const handleAddStudent = async (rawStudent) => { 
        if (!selectedReportId) {
            setErrorMessage("오류: 리포트 ID가 선택되지 않았습니다.");
            return;
        }
        
        setInitialLoading(true);
        try {
            const processedData = processStudentData([rawStudent]);
            
            if (!processedData || !processedData.students || processedData.students.length === 0) {
                 throw new Error("학생 데이터 변환에 실패했습니다. (processStudentData)");
            }
            const finalStudent = processedData.students[0]; 

            const newStats = await addStudentToReport(selectedReportId, finalStudent);
            
            setCurrentReportData(prev => ({
                ...prev,
                students: [...prev.students, finalStudent], 
                studentCount: newStats.studentCount,
                classAverage: newStats.classAverage,
                answerRates: newStats.answerRates
            }));
            
        } catch (error) {
            console.error("학생 추가 중 오류:", error);
            setErrorMessage("학생 데이터 추가 중 오류: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    };
    
    // ⭐️ [수정] renderNav
    const renderNav = () => {
        if (!currentTeacher || currentPage === 'page1') return null;
        return (
            <nav id="navigation" className="fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-10 flex items-center h-16 print:hidden">
                <div className="container mx-auto max-w-5xl flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <button id="navHome" className="btn btn-primary" onClick={goHome}><Home size={20} /><span className="hidden sm:inline ml-2">처음으로</span></button>
                        <button id="navBack" className="btn btn-secondary" onClick={goBack}><ArrowLeft size={20} /><span className="hidden sm:inline ml-2">뒤로</span></button>
                        <div className="text-sm text-gray-500 hidden sm:flex items-center">
                            {['page2', 'page4', 'page5', 'cum_date_select', 'cum_result_by_date', 'cum_student_select'].includes(currentPage) && <span id="navDateName" className="font-semibold">{`> ${selectedDate || selectedClass}`}</span>}
                            {['page4', 'page5'].includes(currentPage) && selectedClass && <span id="navClassName" className="font-semibold">{`> ${selectedClass}`}</span>}
                            {currentPage === 'page5' && <span id="navReportName" className="font-semibold">{`> ${selectedStudent || '반 전체'}`}</span>}
                        </div>
                    </div>
                    <div id="navActions" className="flex items-center space-x-3">
                        {currentPage === 'page5' && (
                            <button id="savePdfBtn" className="btn btn-secondary btn-sm" onClick={handlePdfSave} data-report-type={selectedStudent ? 'individual' : 'overall'} data-student-name={selectedStudent || ''}>
                                <FileText size={16} className="mr-2" /> PDF로 저장
                            </button>
                        )}
                        <span className="text-sm font-medium text-gray-700 hidden sm:flex items-center"><User size={16} className="mr-1.5" /> {currentTeacher.name}님</span>
                        <button id="logoutBtn" className="btn btn-secondary btn-sm" onClick={handleLogout}>
                            <LogOut size={16} className="mr-0 sm:mr-2" /><span className="hidden sm:inline">로그아웃</span>
                        </button>
                    </div>
                </div>
            </nav>
        );
    };

    const renderPage = () => {
        if (isAuthenticating) {
            return (
                <div id="initialLoader" className="card p-8 text-center mt-20">
                    <div className="spinner mx-auto"></div>
                    <p className="mt-4 text-gray-600">Firebase에 연결하는 중...</p>
                </div>
            );
        }

        if (!currentTeacher) {
            return <LoginPage 
                        onLogin={handleLogin}
                        onRegister={handleRegister} 
                        loginError={loginError} 
                        isLoggingIn={isLoggingIn}
                        setLoginError={setLoginError} 
                    />;
        }

        if (initialLoading) {
            return (
                <div id="initialLoader" className="card p-8 text-center mt-20">
                    <div className="spinner mx-auto"></div>
                    <p className="mt-4 text-gray-600">데이터를 처리 중입니다...</p> 
                </div>
            );
        }
        
        // ⭐️ [수정] 'renderPage' 스위치
        switch (currentPage) {
            case 'page1': 
                return <Page1_Upload 
                            fileInputRef={fileInputRef}
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess} 
                            handleFileDrop={handleFileDrop}
                        />;
            case 'page2': 
                return <Page2_ClassSelect 
                            handleDeleteClass={handleDeleteClass} 
                            selectedDate={selectedDate}
                            handleSelectReport={loadAndShowReport}
                        />;
            case 'page3': 
                return <Page3_DateSelect 
                            handleDeleteDate={handleDeleteDate} 
                        />;
            case 'page4': 
                return <Page4_ReportSelect 
                            handleDeleteStudent={handleDeleteStudent} 
                            handleAddStudent={handleAddStudent}
                            selectedClass={selectedClass}         
                            selectedDate={selectedDate}
                            handleSelectReport={loadAndShowReport}
                        />;
            case 'page5': return <Page5_ReportDisplay />;
            
            // ⭐️ [신규] 누적 분석 페이지들
            case 'cum_landing': return <Page_Cumulative_Landing />;
            case 'cum_date_select': return <Page_Cumulative_DateSelect nextStep="cum_result_by_date" />;
            case 'cum_student_select': return <Page_Cumulative_Result mode="by_student" />;
            case 'cum_result_by_date': return <Page_Cumulative_Result mode="by_date" />;

            default:
                return <Page1_Upload 
                            fileInputRef={fileInputRef}
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess} 
                            handleFileDrop={handleFileDrop}
                        />;
        }
    };

    const renderGlobalError = () => {
        if (!errorMessage || currentPage === 'page1') return null; 
        return ( <div id="global-error-message" className="fixed top-16 left-0 right-0 z-20 p-4 bg-red-100 border-b border-red-300 text-red-700 text-sm flex items-center" >
            <TriangleAlert size={18} className="mr-2 flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: errorMessage.replace(/\n/g, '<br>') }}/>
        </div> );
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl">
            {renderNav()}
            {renderGlobalError()} 
            <main className={currentTeacher && currentPage !== 'page1' ? 'mt-16 pt-8' : ''}>
                {renderPage()}
            </main>
        </div>
    );
};

export default App;