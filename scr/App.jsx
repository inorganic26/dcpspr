// scr/App.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useReportContext } from './context/ReportContext';
// ⭐️ [수정] 'loadDataFromFirestore', 'saveDataToFirestore' 대신 신규 함수들 임포트
import { 
    loginTeacher, registerTeacher, 
    loadReportSummaries, loadReportDetails, 
    deleteReport, deleteStudentFromReport 
} from './hooks/useFirebase';
import { useFileProcessor } from './hooks/useFileProcessor';
import { useReportGenerator } from './hooks/useReportGenerator';
import { useChartAndPDF } from './hooks/useChartAndPDF';
import { usePagination } from './hooks/usePagination';
import { useReportNavigation } from './hooks/useReportNavigation';

import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebaseConfig'; 

import { Home, ArrowLeft, UploadCloud, FileText, Loader, TriangleAlert, Save, PlusCircle, CalendarDays, LogOut, User, Trash2 } from 'lucide-react';

// ... (Page1_Upload 컴포넌트는 기존과 동일) ...
const Page1_Upload = ({ handleFileChange, handleFileProcess, fileInputRef, selectedFiles, handleFileDrop }) => { 
    const { 
        processing, errorMessage, uploadDate, setUploadDate, showPage, 
        // ⭐️ [수정] 'testData' 대신 'reportSummaries'
        reportSummaries, setSelectedDate, setErrorMessage 
    } = useReportContext();
    const [isDragging, setIsDragging] = useState(false); 
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileDrop(e.dataTransfer.files); e.dataTransfer.clearData();
        }
    };
    const getTodayISO = () => new Date().toISOString().split('T')[0];
    const formatISOToMMDD = (isoStr) => {
        if (!isoStr) return "";
        try { const [year, month, day] = isoStr.split('-'); return `${parseInt(month, 10)}월 ${parseInt(day, 10)}일`; } catch (e) { return ""; }
    };
    const formatMMDDToISO = (mmddStr) => {
        if (!mmddStr) return getTodayISO();
        const match = mmddStr.match(/(\d+)월 (\d+)일/);
        if (match) { const year = new Date().getFullYear(); const month = match[1].padStart(2, '0'); const day = match[2].padStart(2, '0'); return `${year}-${month}-${day}`; }
        return getTodayISO();
    };
    const [isoDate, setIsoDate] = useState(() => formatMMDDToISO(uploadDate));
    useEffect(() => {
        if (!uploadDate) { const todayISO = getTodayISO(); setIsoDate(todayISO); setUploadDate(formatISOToMMDD(todayISO)); }
    }, [uploadDate, setUploadDate]);
    const handleDateChange = (e) => { const newIsoDate = e.target.value; setIsoDate(newIsoDate); setUploadDate(formatISOToMMDD(newIsoDate)); };
    
    const handleViewExistingByDate = () => {
        if (!uploadDate) { setErrorMessage('먼저 조회할 날짜를 선택해주세요.'); return; }
        
        // ⭐️ [수정] 'reportSummaries'에서 날짜 검색
        const allDates = new Set(reportSummaries.map(r => r.date));
        
        if (allDates.has(uploadDate)) { 
            setErrorMessage(''); 
            setSelectedDate(uploadDate); 
            showPage('page2'); // 반 선택 페이지로 이동
        } else { 
            setErrorMessage(`'${uploadDate}'에 해당하는 분석된 리포트가 없습니다. \n다른 날짜를 선택하거나 '모든 날짜 보기'를 클릭하세요.`); 
        }
    };
    
    return (
        <div id="fileUploadCard" className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">AI 성적 리포트 분석기</h2>
            <div className="mb-4">
                <label htmlFor="dateInput" className="block text-sm font-medium text-gray-700 mb-1">시험 날짜 (필수)</label>
                <div className="relative"><input type="date" id="dateInput" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={isoDate} onChange={handleDateChange} /></div>
            </div>
            <p className="text-center text-gray-600 mb-6">분석할 PDF 시험지 파일과 학생 성적 데이터(CSV 또는 XLSX)를 함께 업로드해주세요. (파일 이름에 **반 이름**이 포함되어야 합니다)</p>
            <div className={`p-6 border-2 border-dashed rounded-xl transition-colors mb-4 ${ isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400' }`} onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <div className="flex flex-col items-center justify-center space-y-3">
                    <UploadCloud size={30} className={`text-gray-400 transition-colors ${isDragging ? 'text-indigo-600' : ''}`} />
                    <p className={`text-lg font-semibold transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-500'}`}>파일을 여기에 드래그하거나</p>
                    <label htmlFor="fileInput" className="btn btn-primary cursor-pointer max-w-xs"><span>파일 선택하기</span></label>
                    <input type="file" id="fileInput" ref={fileInputRef} className="hidden" multiple accept=".pdf,.csv,.xlsx" onChange={handleFileChange} />
                </div>
            </div>
            {selectedFiles.length > 0 && (
                <div id="fileListContainer" className="mb-4">
                    <h4 className="font-semibold mb-2 text-gray-600">선택된 파일:</h4>
                    <ul id="fileList" className="list-disc list-inside bg-gray-50 p-4 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
                        {selectedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                    </ul>
                </div>
            )}
            {errorMessage && ( <div id="error-message" className="text-red-600 bg-red-100 p-3 rounded-lg mb-4 text-sm" dangerouslySetInnerHTML={{ __html: errorMessage.replace(/\n/g, '<br>') }} /> )}
            <button id="processBtn" className="btn btn-primary w-full text-lg" disabled={processing || selectedFiles.length === 0} onClick={handleFileProcess}>
                {processing && <span id="loader" className="spinner" style={{ borderColor: 'white', borderBottomColor: 'transparent', width: '20px', height: '20px', marginRight: '8px' }}></span>}
                <span>{processing ? '분석 중...' : '분석 시작하기'}</span>
            </button>
            <div className="grid grid-cols-2 gap-4 mt-4">
                <button className="btn btn-primary w-full text-md" onClick={handleViewExistingByDate} disabled={processing}><CalendarDays size={18} className="mr-2" /> 선택 날짜 조회</button>
                <button className="btn btn-secondary w-full text-md" onClick={() => { setErrorMessage(''); showPage('page3'); }} disabled={processing}>모든 날짜 보기</button>
            </div>
        </div>
    );
};

// ... (Page2_ClassSelect 컴포넌트 수정) ...
const Page2_ClassSelect = ({ handleDeleteClass, selectedDate, handleSelectReport }) => { 
    // ⭐️ [수정] 'testData' 대신 'reportSummaries'
    const { reportSummaries, setSelectedClass, showPage, setSelectedReportId } = useReportContext();
    
    // ⭐️ [수정] 선택된 날짜에 해당하는 '반 이름' 목록을 'reportSummaries'에서 찾기
    const classesForDate = reportSummaries
        .filter(r => r.date === selectedDate)
        .map(r => r.className);
    
    const uniqueClasses = [...new Set(classesForDate)]; // 중복 제거

    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">{selectedDate} - 반 선택</h2>
            <div id="classButtons" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniqueClasses.length > 0 ? (
                    uniqueClasses.map(className => (
                        <div key={className} className="relative flex w-full">
                            <button 
                                className="btn btn-secondary w-full text-left pr-12" 
                                // ⭐️ [수정] 클릭 시 'reportId'를 찾아 App.jsx의 핸들러 호출
                                onClick={() => {
                                    const report = reportSummaries.find(r => r.date === selectedDate && r.className === className);
                                    if (report) {
                                        setSelectedReportId(report.id);
                                        setSelectedClass(className);
                                        // App.jsx의 loadAndShowReport 함수가 호출됨
                                        handleSelectReport(report.id, 'page4'); 
                                    }
                                }}
                            >
                                {className}
                            </button>
                            <button 
                                className="absolute right-1 top-1 bottom-1 btn btn-secondary h-auto px-2 text-red-500 hover:bg-red-100 hover:border-red-300" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // ⭐️ [수정] 삭제 핸들러가 reportId를 찾도록 전달
                                    const report = reportSummaries.find(r => r.date === selectedDate && r.className === className);
                                    if(report) {
                                        handleDeleteClass(report.id, className, selectedDate); 
                                    }
                                }}
                                title={`${className} 데이터 삭제`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                ) : ( <p className="text-center text-gray-500 col-span-full">선택한 날짜에 해당하는 데이터가 없습니다.</p> )}
            </div>
        </div>
    );
};

// ... (Page3_DateSelect 컴포넌트 수정) ...
const Page3_DateSelect = ({ handleDeleteDate }) => { 
    // ⭐️ [수정] 'testData' 대신 'reportSummaries'
    const { reportSummaries, setSelectedDate, showPage } = useReportContext();
    
    // ⭐️ [수정] 'reportSummaries'에서 모든 날짜 추출
    const allDates = new Set(reportSummaries.map(r => r.date));
    const uniqueDates = Array.from(allDates);

    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">시험 날짜 선택</h2>
            <div id="dateButtons" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueDates.length > 0 ? (
                    uniqueDates.map(date => (
                        <div key={date} className="relative flex w-full">
                            <button 
                                className="btn btn-secondary w-full text-left pr-12" 
                                onClick={() => { 
                                    setSelectedDate(date); 
                                    showPage('page2'); // 반 선택 페이지로 이동
                                }}
                            >
                                {date}
                            </button>
                            <button 
                                className="absolute right-1 top-1 bottom-1 btn btn-secondary h-auto px-2 text-red-500 hover:bg-red-100 hover:border-red-300" 
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    handleDeleteDate(date); // App.jsx의 삭제 핸들러
                                }}
                                title={`${date} 데이터 삭제`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))
                ) : ( 
                    <p className="text-center text-gray-500 col-span-full py-8">저장된 데이터가 없습니다. <br /> '처음으로' 버튼을 눌러 데이터를 추가해주세요.</p> 
                )}
            </div>
        </div>
    );
};


// ... (Page4_ReportSelect 컴포넌트 수정) ...
const Page4_ReportSelect = ({ handleDeleteStudent, selectedClass, selectedDate, handleSelectReport }) => { 
    // ⭐️ [수정] 'testData' 대신 'currentReportData'
    const { currentReportData, selectedStudent, setSelectedStudent, showPage, selectedReportId } = useReportContext();
    
    // ⭐️ [수정] 데이터 참조 변경 (currentReportData.students)
    const students = currentReportData?.students || [];
    
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">리포트 선택</h2>
            
            <div id="reportSelectionButtons" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                
                <button 
                    className={`btn btn-secondary w-full ${selectedStudent === null ? 'btn-nav-active' : ''}`}
                    onClick={() => { 
                        setSelectedStudent(null); 
                        // ⭐️ [수정] App.jsx의 핸들러 호출
                        handleSelectReport(selectedReportId, 'page5'); 
                    }}
                >
                    반 전체
                </button>
                
                {students.map(student => (
                    <div key={student.name} className="relative flex"> 
                        <button 
                            className={`btn btn-secondary w-full text-left pr-10 ${selectedStudent === student.name ? 'btn-nav-active' : ''}`} 
                            onClick={() => { 
                                setSelectedStudent(student.name); 
                                // ⭐️ [수정] App.jsx의 핸들러 호출
                                handleSelectReport(selectedReportId, 'page5'); 
                            }}
                        >
                            {student.name}
                        </button>
                        <button 
                            className="absolute right-1 top-1 bottom-1 btn btn-secondary h-auto px-2 text-red-500 hover:bg-red-100 hover:border-red-300"
                            onClick={(e) => {
                                e.stopPropagation();
                                // ⭐️ [수정] 삭제 핸들러 호출
                                handleDeleteStudent(student.name, selectedClass, selectedDate); 
                            }}
                            title={`${student.name} 학생 데이터 삭제`}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};


// ... (Page5_ReportDisplay, LoginPage 컴포넌트는 기존과 동일) ...
const Page5_ReportDisplay = () => { 
    const { reportHTML } = useReportContext();
    const reportContentRef = usePagination(); 
    return (
        <div id="reportContainer" ref={reportContentRef} >
            <div id="reportContent" className="space-y-6" dangerouslySetInnerHTML={{ __html: reportHTML }} />
            <div id="pagination-controls" className="flex justify-center items-center space-x-4 mt-4 print:hidden" style={{ display: 'none' }}>
                <button id="prevPageBtn" className="btn btn-secondary">&lt; 이전</button>
                <span id="pageIndicator">1 / 3</span>
                <button id="nextPageBtn" className="btn btn-secondary">다음 &gt;</button>
            </div>
        </div>
    );
};
const LoginPage = ({ onLogin, onRegister, loginError, isLoggingIn, setLoginError }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !phone) { alert('이름과 전화번호 뒷 4자리를 입력하세요.'); return; }
        if (isRegisterMode) {
            onRegister(name, phone);
        } else {
            onLogin(name, phone);
        }
    };
    return (
        <div className="card max-w-md mx-auto mt-20">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">{isRegisterMode ? '선생님 등록' : 'AI 성적 리포트 분석기'}</h2>
            <p className="text-center text-gray-600 mb-6">{isRegisterMode ? '사용하실 이름과 전화번호 뒷 4자리를 입력하세요.' : '로그인이 필요합니다. (선생님용)'}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
                    <input type="text" id="name" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 박명신" disabled={isLoggingIn} />
                </div>
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">전화번호 뒷 4자리</label>
                    <input type="tel" id="phone" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="예: 1775" maxLength={4} pattern="\d{4}" disabled={isLoggingIn} />
                </div>
                {loginError && (
                    <div className="text-red-600 bg-red-100 p-3 rounded-lg text-sm"><TriangleAlert className="w-4 h-4 mr-2 inline" />{loginError}</div>
                )}
                <button type="submit" className="btn btn-primary w-full text-lg" disabled={isLoggingIn || !name || !phone}>
                    {isLoggingIn && <span className="spinner" style={{ borderColor: 'white', borderBottomColor: 'transparent', width: '20px', height: '20px', marginRight: '8px' }}></span>}
                    <span>{isLoggingIn ? '처리 중...' : (isRegisterMode ? '등록하기' : '로그인')}</span>
                </button>
            </form>
            <div className="text-center mt-6">
                <button
                    onClick={() => {
                        setIsRegisterMode(!isRegisterMode);
                        setLoginError(''); 
                    }}
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    disabled={isLoggingIn}
                >
                    {isRegisterMode ? '이미 계정이 있으신가요? 로그인하기' : '계정이 없으신가요? 등록하기'}
                </button>
            </div>
        </div>
    );
};


// --- 5. 메인 App 컴포넌트 ---
const App = () => {
    const {
        currentPage, selectedClass, selectedDate, selectedStudent,
        initialLoading, setInitialLoading,
        errorMessage, setErrorMessage,
        currentTeacher, setCurrentTeacher,
        
        // ⭐️ [수정] 'testData' 대신 신규 상태 사용
        reportSummaries, setReportSummaries,
        setCurrentReportData,
        selectedReportId, setSelectedReportId,
        
        showPage, resetSelections
    } = useReportContext();
    
    const [isAuthenticating, setIsAuthenticating] = useState(true); 
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');

    // ⭐️ [수정] 'saveDataToFirestore' prop 제거
    const { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop } = useFileProcessor({
        /* saveDataToFirestore: ... 제거 */
    });
    const { goBack, goHome } = useReportNavigation();
    
    // ⭐️ [수정] 'useReportGenerator'는 더 이상 props가 필요 없음
    useReportGenerator(); 
    
    const { handlePdfSave } = useChartAndPDF(); 
    
    // (네트워크 모니터링, 익명 인증 useEffect는 변경 없음)
    useEffect(() => {
        // ... (네트워크 모니터링) ...
    }, [setErrorMessage]); 

    useEffect(() => {
        const authenticate = async () => {
            try {
                if (!auth.currentUser) { 
                    console.log("[Auth] 익명 로그인 시도...");
                    await signInAnonymously(auth);
                    console.log("[Auth] 익명 로그인 성공:", auth.currentUser.uid);
                } else {
                    console.log("[Auth] 기존 세션 유지:", auth.currentUser.uid);
                }
                setIsAuthenticating(false); 
            } catch (error) {
                console.error("[Auth] 익명 로그인 실패:", error);
                setLoginError("Firebase 인증에 실패했습니다. " + error.message);
                setIsAuthenticating(false); 
            }
        };
        authenticate();
    }, []); 


    // (handleLogin, handleRegister 핸들러는 변경 없음)
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
    
    // ⭐️ [수정] 'performSuccessfulLogin' (요약 정보 로드)
    const performSuccessfulLogin = async (teacher) => {
        setCurrentTeacher(teacher); 
        setInitialLoading(true); 
        
        try {
            // ⭐️ [수정] 'loadDataFromFirestore' -> 'loadReportSummaries'
            const loadedSummaries = await loadReportSummaries(); 
            setReportSummaries(loadedSummaries || []); 

        } catch (error) {
            console.error("데이터 요약 로드 실패:", error);
            setLoginError("로그인은 성공했으나 요약 로드에 실패했습니다: " + error.message);
            setReportSummaries([]); 

        } finally {
            setInitialLoading(false); 
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        setCurrentTeacher(null);
        setReportSummaries([]); // ⭐️ [수정]
        resetSelections(); // ⭐️ [수정]
        showPage('page1');
        setErrorMessage('');
    };
    
    // ⭐️ [신규] 리포트 상세 데이터 로드 함수
    const loadAndShowReport = useCallback(async (reportId, pageToShow) => {
        if (!reportId) return;
        setInitialLoading(true);
        try {
            const details = await loadReportDetails(reportId);
            setCurrentReportData(details);
            showPage(pageToShow);
        } catch (error) {
            setErrorMessage("리포트 상세 내역 로드 실패: " + error.message);
            showPage('page3'); // 오류 시 날짜 선택으로
        } finally {
            setInitialLoading(false);
        }
    }, [setCurrentReportData, setInitialLoading, setErrorMessage, showPage]);

    
    // ⭐️ [수정] 'handleDeleteDate' (날짜별 삭제)
    const handleDeleteDate = async (dateToDelete) => {
        if (!window.confirm(`'${dateToDelete}'의 모든 분석 데이터를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        setErrorMessage('삭제 중...'); 
        setInitialLoading(true); 

        // ⭐️ [수정] 삭제할 리포트 ID 목록 찾기
        const reportsToDelete = reportSummaries.filter(r => r.date === dateToDelete);
        
        try {
            // ⭐️ [수정] 'deleteReport' 함수 병렬 호출
            await Promise.all(reportsToDelete.map(report => deleteReport(report.id)));
            
            // ⭐️ [수정] 로컬 'reportSummaries' 상태 업데이트
            setReportSummaries(prev => prev.filter(r => r.date !== dateToDelete));
            
            setErrorMessage(''); 
            
        } catch (error) {
            console.error("데이터 삭제 실패:", error);
            setErrorMessage("데이터 삭제 중 오류가 발생했습니다: " + error.message);
        } finally {
            setInitialLoading(false); 
        }
    };
    
    // ⭐️ [수정] 'handleDeleteClass' (반별 삭제)
    const handleDeleteClass = async (reportId, className, date) => {
        if (!window.confirm(`'${date}'의 '${className}'반 데이터를 정말 삭제하시겠습니까?`)) {
            return;
        }
        setInitialLoading(true); 
        try {
            // ⭐️ [수정] 'deleteReport' 함수 호출
            await deleteReport(reportId);
            
            // ⭐️ [수정] 로컬 'reportSummaries' 상태 업데이트
            setReportSummaries(prev => prev.filter(r => r.id !== reportId));

        } catch (error) {
            setErrorMessage("반 데이터 삭제 중 오류: " + error.message);
        } finally {
            setInitialLoading(false);
            // ⭐️ [수정] 현재 페이지에 머무름 (Page2_ClassSelect)
        }
    };

    // ⭐️ [수정] 'handleDeleteStudent' (학생별 삭제)
    const handleDeleteStudent = async (studentName, className, date) => {
        if (!window.confirm(`'${date}' - '${className}'반의 '${studentName}' 학생 데이터를 정말 삭제하시겠습니까?\n\n(참고: 학생 삭제 시 반 전체 평균이 자동으로 재계산되지는 않습니다.)`)) {
            return;
        }
        if (!selectedReportId) {
            setErrorMessage("오류: 리포트 ID가 선택되지 않았습니다.");
            return;
        }
        
        setInitialLoading(true); 
        try {
            // ⭐️ [수정] 'deleteStudentFromReport' 함수 호출
            await deleteStudentFromReport(selectedReportId, studentName);
            
            // ⭐️ [수정] 로컬 'currentReportData' 상태 업데이트
            setCurrentReportData(prev => ({
                ...prev,
                students: prev.students.filter(s => s.name !== studentName)
            }));
            
        } catch (error) {
            setErrorMessage("학생 데이터 삭제 중 오류: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    };


    // (renderNav, renderGlobalError 렌더링 로직은 변경 없음)
    
    const renderNav = () => {
        if (!currentTeacher || currentPage === 'page1') return null;
        return (
            <nav id="navigation" className="fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-10 flex items-center h-16 print:hidden">
                <div className="container mx-auto max-w-5xl flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <button id="navHome" className="btn btn-primary" onClick={goHome}><Home size={20} /><span className="hidden sm:inline ml-2">처음으로</span></button>
                        <button id="navBack" className="btn btn-secondary" onClick={goBack}><ArrowLeft size={20} /><span className="hidden sm:inline ml-2">뒤로</span></button>
                        <div className="text-sm text-gray-500 hidden sm:flex items-center">
                            {['page2', 'page4', 'page5'].includes(currentPage) && <span id="navDateName" className="font-semibold">{`> ${selectedDate}`}</span>}
                            {['page4', 'page5'].includes(currentPage) && <span id="navClassName" className="font-semibold">{`> ${selectedClass}`}</span>}
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
        
        // ⭐️ [수정] 'renderPage' 스위치 (prop 전달 변경)
        switch (currentPage) {
            case 'page1': 
                return <Page1_Upload 
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess}
                            fileInputRef={fileInputRef}
                            selectedFiles={selectedFiles} 
                            handleFileDrop={handleFileDrop}
                        />;
            case 'page2': 
                return <Page2_ClassSelect 
                            handleDeleteClass={handleDeleteClass} 
                            selectedDate={selectedDate}
                            // ⭐️ [신규] 리포트 로딩 함수 전달
                            handleSelectReport={loadAndShowReport}
                        />;
            case 'page3': 
                return <Page3_DateSelect 
                            handleDeleteDate={handleDeleteDate} 
                        />;
            case 'page4': 
                return <Page4_ReportSelect 
                            handleDeleteStudent={handleDeleteStudent} 
                            selectedClass={selectedClass}         
                            selectedDate={selectedDate}
                            // ⭐️ [신규] 리포트 로딩 함수 전달
                            handleSelectReport={loadAndShowReport}
                        />;
            case 'page5': return <Page5_ReportDisplay />;
            default:
                return <Page1_Upload 
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess}
                            fileInputRef={fileInputRef}
                            selectedFiles={selectedFiles} 
                            handleFileDrop={handleFileDrop}
                        />;
        }
    };

    const renderGlobalError = () => {
        if (!errorMessage || currentPage === 'page1') return null; 
        return ( <div id="global-error-message" /* ... (내용 동일) ... */ > </div> );
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