// scr/App.jsx

import React, { useEffect, useRef, useState } from 'react';
import { useReportContext } from './context/ReportContext';
import { loginTeacher, registerTeacher, loadDataFromFirestore, saveDataToFirestore } from './hooks/useFirebase';
import { useFileProcessor } from './hooks/useFileProcessor';
import { useReportGenerator } from './hooks/useReportGenerator';
import { useChartAndPDF } from './hooks/useChartAndPDF';
import { usePagination } from './hooks/usePagination';
import { useReportNavigation } from './hooks/useReportNavigation';

import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebaseConfig'; 

import { Home, ArrowLeft, UploadCloud, FileText, Loader, TriangleAlert, Save, PlusCircle, CalendarDays, LogOut, User } from 'lucide-react';

// ... (Page1_Upload ~ Page5_ReportDisplay 컴포넌트는 기존과 동일) ...
const Page1_Upload = ({ handleFileChange, handleFileProcess, fileInputRef, selectedFiles, handleFileDrop }) => { 
    // ... (이 컴포넌트의 코드는 이전과 동일) ...
    const { 
        processing, errorMessage, uploadDate, setUploadDate, showPage, 
        testData, setSelectedDate, setErrorMessage 
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
        const allDates = new Set();
        if (testData && typeof testData === 'object') {
            Object.values(testData).forEach(classData => {
                if (classData && typeof classData === 'object') { Object.keys(classData).forEach(date => { allDates.add(date); }); }
            });
        }
        if (allDates.has(uploadDate)) { setErrorMessage(''); setSelectedDate(uploadDate); showPage('page2'); } else { setErrorMessage(`'${uploadDate}'에 해당하는 분석된 리포트가 없습니다. \n다른 날짜를 선택하거나 '모든 날짜 보기'를 클릭하세요.`); }
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
const Page2_ClassSelect = () => { 
    // ... (이 컴포넌트의 코드는 이전과 동일) ...
    const { testData, selectedDate, setSelectedClass, showPage } = useReportContext();
    const classesForDate = Object.keys(testData).filter(className => testData[className] && testData[className][selectedDate]);
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">{selectedDate} - 반 선택</h2>
            <div id="classButtons" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classesForDate.length > 0 ? (
                    classesForDate.map(className => (
                        <button key={className} className="btn btn-secondary" onClick={() => { setSelectedClass(className); showPage('page4'); }}>{className}</button>
                    ))
                ) : ( <p className="text-center text-gray-500 col-span-full">선택한 날짜에 해당하는 데이터가 없습니다.</p> )}
            </div>
        </div>
    );
};
const Page3_DateSelect = () => { 
    // ... (이 컴포넌트의 코드는 이전과 동일) ...
    const { testData, setSelectedDate, showPage } = useReportContext();
    const allDates = new Set();
    Object.values(testData).forEach(classData => { Object.keys(classData).forEach(date => { allDates.add(date); }); });
    const uniqueDates = Array.from(allDates);
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">시험 날짜 선택</h2>
            <div id="dateButtons" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {uniqueDates.length > 0 ? (
                    uniqueDates.map(date => (
                        <button key={date} className="btn btn-secondary" onClick={() => { setSelectedDate(date); showPage('page2'); }}>{date}</button>
                    ))
                ) : ( <p className="text-center text-gray-500 col-span-full py-8">저장된 데이터가 없습니다. <br /> '처음으로' 버튼을 눌러 데이터를 추가해주세요.</p> )}
            </div>
        </div>
    );
};
const Page4_ReportSelect = () => { 
    // ... (이 컴포넌트의 코드는 이전과 동일) ...
    const { testData, selectedClass, selectedDate, selectedStudent, setSelectedStudent, showPage } = useReportContext();
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">리포트 선택</h2>
            <div id="reportSelectionButtons" className="flex flex-wrap justify-center gap-3">
                <button className={`btn btn-secondary ${selectedStudent === null ? 'btn-nav-active' : ''}`} onClick={() => { setSelectedStudent(null); showPage('page5'); }}>반 전체</button>
                {testData[selectedClass]?.[selectedDate]?.studentData?.students.map(student => (
                    <button key={student.name} className={`btn btn-secondary ${selectedStudent === student.name ? 'btn-nav-active' : ''}`} onClick={() => { setSelectedStudent(student.name); showPage('page5'); }}>{student.name}</button>
                ))}
            </div>
        </div>
    );
};
const Page5_ReportDisplay = () => { 
    // ... (이 컴포넌트의 코드는 이전과 동일) ...
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


// ... (LoginPage 컴포넌트는 기존과 동일) ...
const LoginPage = ({ onLogin, onRegister, loginError, isLoggingIn, setLoginError }) => {
    // ... (이 컴포넌트의 코드는 이전과 동일) ...
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
        setTestData, showPage
    } = useReportContext();
    
    const [isAuthenticating, setIsAuthenticating] = useState(true); 
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');

    const { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop } = useFileProcessor({ saveDataToFirestore });
    const { goBack, goHome } = useReportNavigation();
    
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
    
    // ⭐️ --- [버그 수정] 로그인/등록 성공 시 공통 로직 ---
    const performSuccessfulLogin = async (teacher) => {
        setCurrentTeacher(teacher); // Context에 선생님 정보 저장
        setInitialLoading(true); // "로딩 중" 화면 표시
        
        try {
            // ⭐️ 1. '공용' 데이터를 불러옵니다.
            const loadedData = await loadDataFromFirestore(); 
            setTestData(loadedData || {}); // Context에 공용 데이터 저장

        } catch (error) {
            // ⭐️ 2. [추가] 로드에 실패해도 앱이 멈추지 않도록 오류 처리
            console.error("데이터 로드 실패:", error);
            // ⭐️ 로그인 오류가 아니라, 로딩 오류임을 명시
            setLoginError("로그인은 성공했으나 데이터 로드에 실패했습니다: " + error.message);
            setTestData({}); // ⭐️ 빈 데이터로 설정

        } finally {
            // ⭐️ 3. [추가] 성공하든, 실패하든, "로딩 중"을 '반드시' 끝냅니다.
            setInitialLoading(false); 
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        setCurrentTeacher(null);
        setTestData({});
        showPage('page1');
        setErrorMessage('');
    };


    // (renderNav, renderPage, renderGlobalError 렌더링 로직은 변경 없음)
    
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
        // (익명 인증 로딩 확인)
        if (isAuthenticating) {
            return (
                <div id="initialLoader" className="card p-8 text-center mt-20">
                    <div className="spinner mx-auto"></div>
                    <p className="mt-4 text-gray-600">Firebase에 연결하는 중...</p>
                </div>
            );
        }

        // (선생님 로그인 확인)
        if (!currentTeacher) {
            return <LoginPage 
                        onLogin={handleLogin}
                        onRegister={handleRegister} 
                        loginError={loginError} 
                        isLoggingIn={isLoggingIn}
                        setLoginError={setLoginError} 
                    />;
        }

        // ⭐️ [여기] 버그가 수정되어, 로딩이 멈추지 않고 이 화면을 보여주거나,
        // ⭐️ 'initialLoading'이 false가 되어 다음 switch문으로 넘어갑니다.
        if (initialLoading) {
            return (
                <div id="initialLoader" className="card p-8 text-center mt-20">
                    <div className="spinner mx-auto"></div>
                    <p className="mt-4 text-gray-600">{currentTeacher.name} 선생님의 공용 데이터를 불러오는 중입니다...</p>
                </div>
            );
        }
        
        // (페이지 렌더링 switch 문)
        switch (currentPage) {
            case 'page1': 
                return <Page1_Upload 
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess}
                            fileInputRef={fileInputRef}
                            selectedFiles={selectedFiles} 
                            handleFileDrop={handleFileDrop}
                        />;
            case 'page2': return <Page2_ClassSelect />;
            case 'page3': return <Page3_DateSelect />;
            case 'page4': return <Page4_ReportSelect />;
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
        // ... (내용 동일) ...
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