// scr/App.jsx

import React, { useEffect, useRef, useCallback, useState } from 'react';

// 1. Context와 훅들 임포트
import { useReportContext } from './context/ReportContext';
import { useFirebase } from './hooks/useFirebase';
import { useFileProcessor } from './hooks/useFileProcessor';
import { useReportGenerator } from './hooks/useReportGenerator';
import { useChartAndPDF } from './hooks/useChartAndPDF';
import { usePagination } from './hooks/usePagination';
import { useReportNavigation } from './hooks/useReportNavigation';

// 2. 아이콘 임포트
import { Home, ArrowLeft, UploadCloud, FileText, Loader, TriangleAlert, Save, PlusCircle, CalendarDays } from 'lucide-react';

// 3. 오늘 날짜를 "M월 D일" 형식으로 반환하는 헬퍼 함수
const getTodayDateString = () => {
    // ... (내용 동일) ...
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return `${month}월 ${day}일`;
};

// --- 4. 페이지별 컴포넌트 ---
// ... (Page1_Upload, Page2_ClassSelect, Page3_DateSelect, Page4_ReportSelect, Page5_ReportDisplay 컴포넌트 코드는 기존과 동일) ...
const Page1_Upload = ({ authError, handleFileChange, handleFileProcess, fileInputRef, selectedFiles, handleFileDrop }) => {
    // ... (내용 동일) ...
    const { 
        processing, errorMessage, uploadDate, setUploadDate, showPage, 
        testData, setSelectedDate, setErrorMessage 
    } = useReportContext();
    const [isDragging, setIsDragging] = useState(false); 
    const handleDragOver = (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false); 
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileDrop(e.dataTransfer.files); 
            e.dataTransfer.clearData();
        }
    };
    const getTodayISO = () => new Date().toISOString().split('T')[0];
    const formatISOToMMDD = (isoStr) => {
        if (!isoStr) return "";
        try {
            const [year, month, day] = isoStr.split('-');
            return `${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
        } catch (e) { return ""; }
    };
    const formatMMDDToISO = (mmddStr) => {
        if (!mmddStr) return getTodayISO();
        const match = mmddStr.match(/(\d+)월 (\d+)일/);
        if (match) {
            const year = new Date().getFullYear();
            const month = match[1].padStart(2, '0');
            const day = match[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return getTodayISO();
    };
    const [isoDate, setIsoDate] = useState(() => formatMMDDToISO(uploadDate));
    useEffect(() => {
        if (!uploadDate) {
            const todayISO = getTodayISO();
            setIsoDate(todayISO);
            setUploadDate(formatISOToMMDD(todayISO));
        }
    }, [uploadDate, setUploadDate]);
    const handleDateChange = (e) => {
        const newIsoDate = e.target.value;
        setIsoDate(newIsoDate); 
        setUploadDate(formatISOToMMDD(newIsoDate)); 
    };
    const handleViewExistingByDate = () => {
        if (!uploadDate) {
            setErrorMessage('먼저 조회할 날짜를 선택해주세요.');
            return;
        }
        const allDates = new Set();
        if (testData && typeof testData === 'object') {
            Object.values(testData).forEach(classData => {
                if (classData && typeof classData === 'object') {
                    Object.keys(classData).forEach(date => {
                        allDates.add(date);
                    });
                }
            });
        }
        if (allDates.has(uploadDate)) {
            setErrorMessage(''); 
            setSelectedDate(uploadDate);
            showPage('page2'); 
        } else {
            setErrorMessage(`'${uploadDate}'에 해당하는 분석된 리포트가 없습니다. \n다른 날짜를 선택하거나 '모든 날짜 보기'를 클릭하세요.`);
        }
    };
    return (
        <div id="fileUploadCard" className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">AI 성적 리포트 분석기</h2>
            <div className="mb-4">
                <label htmlFor="dateInput" className="block text-sm font-medium text-gray-700 mb-1">
                    시험 날짜 (필수)
                </label>
                <div className="relative">
                    <input
                        type="date"
                        id="dateInput"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        value={isoDate} 
                        onChange={handleDateChange} 
                    />
                </div>
            </div>
            <p className="text-center text-gray-600 mb-6">분석할 PDF 시험지 파일과 학생 성적 데이터(CSV 또는 XLSX)를 함께 업로드해주세요. (파일 이름에 **반 이름**이 포함되어야 합니다)</p>
            <div 
                className={`p-6 border-2 border-dashed rounded-xl transition-colors mb-4 ${
                    isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center space-y-3">
                    <UploadCloud size={30} className={`text-gray-400 transition-colors ${isDragging ? 'text-indigo-600' : ''}`} />
                    <p className={`text-lg font-semibold transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-500'}`}>
                        파일을 여기에 드래그하거나
                    </p>
                    <label htmlFor="fileInput" className="btn btn-primary cursor-pointer max-w-xs">
                        <span>파일 선택하기</span>
                    </label>
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
            {errorMessage && (
                <div id="error-message" className="text-red-600 bg-red-100 p-3 rounded-lg mb-4 text-sm"
                    dangerouslySetInnerHTML={{ __html: errorMessage.replace(/\n/g, '<br>') }} />
            )}
            {authError && (
                <div className="text-red-600 bg-red-100 p-3 rounded-lg mb-4 text-sm">
                    <TriangleAlert className="w-4 h-4 mr-2 inline" />
                    Firebase 인증 오류: {authError}
                </div>
            )}
            <button id="processBtn" className="btn btn-primary w-full text-lg" disabled={processing || selectedFiles.length === 0} onClick={handleFileProcess}>
                {processing && <span id="loader" className="spinner" style={{ borderColor: 'white', borderBottomColor: 'transparent', width: '20px', height: '20px', marginRight: '8px' }}></span>}
                <span>{processing ? '분석 중...' : '분석 시작하기'}</span>
            </button>
            <div className="grid grid-cols-2 gap-4 mt-4">
                <button 
                    className="btn btn-primary w-full text-md" 
                    onClick={handleViewExistingByDate}
                    disabled={processing}
                >
                    <CalendarDays size={18} className="mr-2" />
                    선택 날짜 조회
                </button>
                <button 
                    className="btn btn-secondary w-full text-md" 
                    onClick={() => {
                        setErrorMessage(''); 
                        showPage('page3');
                    }}
                    disabled={processing}
                >
                    모든 날짜 보기
                </button>
            </div>
        </div>
    );
};

const Page2_ClassSelect = () => {
    // ... (내용 동일) ...
    const { testData, selectedDate, setSelectedClass, showPage } = useReportContext();
    const classesForDate = Object.keys(testData).filter(className => 
        testData[className] && testData[className][selectedDate]
    );
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">{selectedDate} - 반 선택</h2>
            <div id="classButtons" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classesForDate.length > 0 ? (
                    classesForDate.map(className => (
                        <button
                            key={className}
                            className="btn btn-secondary"
                            onClick={() => {
                                setSelectedClass(className);
                                showPage('page4'); 
                            }}
                        >
                            {className}
                        </button>
                    ))
                ) : (
                    <p className="text-center text-gray-500 col-span-full">
                        선택한 날짜에 해당하는 데이터가 없습니다.
                    </p>
                )}
            </div>
        </div>
    );
};

const Page3_DateSelect = () => {
    // ... (내용 동일) ...
    const { testData, setSelectedDate, showPage } = useReportContext();
    const allDates = new Set();
    Object.values(testData).forEach(classData => {
        Object.keys(classData).forEach(date => {
            allDates.add(date);
        });
    });
    const uniqueDates = Array.from(allDates);
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">시험 날짜 선택</h2>
            <div id="dateButtons" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {uniqueDates.length > 0 ? (
                    uniqueDates.map(date => (
                        <button
                            key={date}
                            className="btn btn-secondary"
                            onClick={() => {
                                setSelectedDate(date);
                                showPage('page2');
                            }}
                        >
                            {date}
                        </button>
                    ))
                ) : (
                    <p className="text-center text-gray-500 col-span-full py-8">
                        저장된 데이터가 없습니다. <br />
                        '처음으로' 버튼을 눌러 데이터를 추가해주세요.
                    </p>
                )}
            </div>
        </div>
    );
};

const Page4_ReportSelect = () => {
    // ... (내용 동일) ...
    const { testData, selectedClass, selectedDate, selectedStudent, setSelectedStudent, showPage } = useReportContext();
    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">리포트 선택</h2>
            <div id="reportSelectionButtons" className="flex flex-wrap justify-center gap-3">
                <button
                    className={`btn btn-secondary ${selectedStudent === null ? 'btn-nav-active' : ''}`}
                    onClick={() => {
                        setSelectedStudent(null);
                        showPage('page5');
                    }}
                >
                    반 전체
                </button>
                {testData[selectedClass]?.[selectedDate]?.studentData?.students.map(student => (
                    <button
                        key={student.name}
                        className={`btn btn-secondary ${selectedStudent === student.name ? 'btn-nav-active' : ''}`}
                        onClick={() => {
                            setSelectedStudent(student.name);
                            showPage('page5');
                        }}
                    >
                        {student.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

const Page5_ReportDisplay = () => {
    // ... (내용 동일) ...
    const { reportHTML } = useReportContext();
    const reportContentRef = usePagination(); 
    return (
        <div 
            id="reportContainer" 
            ref={reportContentRef} 
        >
            <div 
                id="reportContent" 
                className="space-y-6"
                dangerouslySetInnerHTML={{ __html: reportHTML }} 
            />
            <div id="pagination-controls" className="flex justify-center items-center space-x-4 mt-4 print:hidden" style={{ display: 'none' }}>
                <button id="prevPageBtn" className="btn btn-secondary">&lt; 이전</button>
                <span id="pageIndicator">1 / 3</span>
                <button id="nextPageBtn" className="btn btn-secondary">다음 &gt;</button>
            </div>
        </div>
    );
};


// --- 5. 메인 App 컴포넌트 ---
const App = () => {
    const {
        currentPage, selectedClass, selectedDate, selectedStudent,
        initialLoading, authError,
        errorMessage, setErrorMessage
    } = useReportContext();
    
    const { saveDataToFirestore } = useFirebase();
    const { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop } = useFileProcessor({ saveDataToFirestore });
    const { goBack, goHome } = useReportNavigation();
    
    useReportGenerator({ saveDataToFirestore }); 
    const { handlePdfSave } = useChartAndPDF(); 
    
    // ⭐️⭐️⭐️ [방안 3 적용] ⭐️⭐️⭐️
    // 네트워크 상태 모니터링
    useEffect(() => {
        const handleOnline = () => {
            console.log("네트워크 연결됨");
            setErrorMessage(''); // 오류 메시지 초기화
        };
        
        const handleOffline = () => {
            console.log("네트워크 끊김");
            // ⭐️ 참고: 이 메시지는 전역 오류 메시지 (팝업)로 표시됩니다.
            setErrorMessage("인터넷 연결이 끊어졌습니다. 온라인 상태를 확인해주세요.");
        };
        
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // 컴포넌트 언마운트 시 리스너 제거
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setErrorMessage]); // 의존성 배열에 setErrorMessage 추가
    // ⭐️⭐️⭐️ [방안 3 적용 완료] ⭐️⭐️⭐️

    // --- 렌더링 로직 ---
    
    const renderNav = () => {
        // ... (내용 동일) ...
        if (currentPage === 'page1') return null;
        return (
            <nav id="navigation" className="fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-10 flex items-center h-16 print:hidden">
                <div className="container mx-auto max-w-5xl flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <button id="navHome" className="btn btn-primary" onClick={goHome}>
                            <Home size={20} />
                            <span className="hidden sm:inline ml-2">처음으로</span>
                        </button>
                        <button id="navBack" className="btn btn-secondary" onClick={goBack}>
                            <ArrowLeft size={20} />
                            <span className="hidden sm:inline ml-2">뒤로</span>
                        </button>
                        <div className="text-sm text-gray-500 hidden sm:flex items-center">
                            {['page2', 'page4', 'page5'].includes(currentPage) && <span id="navDateName" className="font-semibold">{`> ${selectedDate}`}</span>}
                            {['page4', 'page5'].includes(currentPage) && <span id="navClassName" className="font-semibold">{`> ${selectedClass}`}</span>}
                            {currentPage === 'page5' && <span id="navReportName" className="font-semibold">{`> ${selectedStudent || '반 전체'}`}</span>}
                        </div>
                    </div>
                    <div id="navActions" className="flex-shrink-0">
                        {currentPage === 'page5' && (
                            <button 
                                id="savePdfBtn"
                                data-report-type={selectedStudent ? 'individual' : 'overall'}
                                data-student-name={selectedStudent || ''}
                                className="btn btn-secondary btn-sm"
                                onClick={handlePdfSave}
                            >
                                <FileText size={16} className="mr-2" /> PDF로 저장
                            </button>
                        )}
                    </div>
                </div>
            </nav>
        );
    };

    const renderPage = () => {
        // ... (내용 동일) ...
        if (initialLoading) {
            return (
                <div id="initialLoader" className="card p-8 text-center">
                    <div className="spinner mx-auto"></div>
                    <p className="mt-2 text-gray-600">데이터베이스에서 이전 데이터를 불러오는 중입니다...</p>
                </div>
            );
        }
        switch (currentPage) {
            case 'page1': 
                return <Page1_Upload 
                            authError={authError}
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess}
                            fileInputRef={fileInputRef}
                            selectedFiles={selectedFiles} 
                            handleFileDrop={handleFileDrop}
                        />;
            case 'page2': 
                return <Page2_ClassSelect />;
            case 'page3': 
                return <Page3_DateSelect />;
            case 'page4': 
                return <Page4_ReportSelect />;
            case 'page5': 
                return <Page5_ReportDisplay />;
            default:
                return <Page1_Upload 
                            authError={authError}
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
        return (
            <div 
                id="global-error-message" 
                className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm animate-pulse"
                style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
            >
                <div className="flex items-center">
                    <TriangleAlert className="w-6 h-6 mr-3 flex-shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: errorMessage.replace(/\n/g, '<br>') }} />
                    <button 
                        onClick={() => setErrorMessage('')} 
                        className="ml-4 p-1 rounded-full hover:bg-red-700 text-2xl leading-none"
                    >
                        &times;
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 max-w-5xl">
            {renderNav()}
            {renderGlobalError()} 
            <main className={currentPage !== 'page1' ? 'mt-16 pt-8' : ''}>
                {renderPage()}
            </main>
        </div>
    );
};

export default App;