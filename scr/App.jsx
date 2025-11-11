// scr/App.jsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useReportContext } from './context/ReportContext';
import { 
    loginTeacher, registerTeacher, 
    loadReportSummaries, loadReportDetails, 
    deleteReport, deleteStudentFromReport,
    addStudentToReport
    // ⭐️ [제거] 과목 관리 함수 임포트 제거
} from './hooks/useFirebase';

// ⭐️ [수정] fileParser.js에서 processStudentData 함수 임포트
import { processStudentData } from './lib/fileParser'; 

import { useFileProcessor } from './hooks/useFileProcessor';
import { useReportGenerator } from './hooks/useReportGenerator';
import { useChartAndPDF } from './hooks/useChartAndPDF';
import { usePagination } from './hooks/usePagination';
import { useReportNavigation } from './hooks/useReportNavigation';

import { signInAnonymously } from 'firebase/auth';
import { auth } from './lib/firebaseConfig'; 

// ⭐️ [수정] 'Settings' 아이콘 제거
import { Home, ArrowLeft, UploadCloud, FileText, Loader, TriangleAlert, Save, PlusCircle, CalendarDays, LogOut, User, Trash2 } from 'lucide-react';

// ... (Page1_Upload 컴포넌트 대폭 수정) ...
const Page1_Upload = ({ handleFileChange, handleFileProcess, fileInputRef, selectedFiles, handleFileDrop }) => { 
    const { 
        processing, errorMessage, uploadDate, setUploadDate, showPage, 
        reportSummaries, setSelectedDate, setErrorMessage 
    } = useReportContext();
    const [isDragging, setIsDragging] = useState(false); 
    
    const [inputType, setInputType] = useState('file'); 
    const [directClassName, setDirectClassName] = useState('');
    const [directQuestionCount, setDirectQuestionCount] = useState(20);
    const [directStudents, setDirectStudents] = useState([]);
    const [directForm, setDirectForm] = useState({ name: '', score: '', answers: '' });
    
    // ⭐️ [신규] 선택된 과목(시험 범위) 상태
    const [selectedSubjectKey, setSelectedSubjectKey] = useState('HIGH_1_MIXED'); // ⭐️ 기본값 설정

    // ⭐️ [신규] 하드코딩된 과목 목록
    const subjectOptions = [
        { key: 'MID_3', label: '중학교 3학년 과정' },
        { key: 'HIGH_1_1', label: '고1 공통수학 1' },
        { key: 'HIGH_1_2', label: '고1 공통수학 2' },
        { key: 'HIGH_1_MIXED', label: '고1 혼합 (공통수학 1+2)' },
        // (나중에 여기에 'HIGH_2_SU1', '고2 수1' 등을 추가하면 됨)
    ];

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
        const allDates = new Set(reportSummaries.map(r => r.date));
        if (allDates.has(uploadDate)) { 
            setErrorMessage(''); 
            setSelectedDate(uploadDate); 
            showPage('page2'); 
        } else { 
            setErrorMessage(`'${uploadDate}'에 해당하는 분석된 리포트가 없습니다. \n다른 날짜를 선택하거나 '모든 날짜 보기'를 클릭하세요.`); 
        }
    };
    
    const handleAddStudent = (e) => {
        e.preventDefault();
        setErrorMessage('');
        
        const { name, score, answers } = directForm;
        const qCount = parseInt(directQuestionCount);

        if (!name || !score || !answers || qCount <= 0) {
            setErrorMessage('이름, 총점, 총 문항 수, 정답을 모두 입력해야 합니다.');
            return;
        }

        const answerArray = answers.trim().toUpperCase().split(/[\s,]+/); 

        if (answerArray.length !== qCount) {
            setErrorMessage(`정답 개수(${answerArray.length}개)가 총 문항 수(${qCount}개)와 일치하지 않습니다.`);
            return;
        }

        const newStudent = {
            "이름": name,
            "총점": parseFloat(score),
        };
        
        answerArray.forEach((ans, index) => {
            newStudent[index + 1] = ans; 
        });

        setDirectStudents(prev => [...prev, newStudent]);
        setDirectForm({ name: '', score: '', answers: '' }); 
    };

    const handleRemoveStudent = (indexToRemove) => {
        setDirectStudents(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // --- ⭐️ [수정] '분석 시작하기' 버튼 클릭 핸들러 ---
    const onProcessStart = () => {
        if (!selectedSubjectKey) {
            setErrorMessage('시험 범위를 선택해야 AI가 정확한 유형을 분석할 수 있습니다.');
            return;
        }
        
        // ⭐️ [수정] 'selectedSubjectKey' 전달
        handleFileProcess(inputType, {
            className: directClassName,
            students: directStudents,
        }, selectedSubjectKey); 
    };

    return (
        <div id="fileUploadCard" className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">AI 성적 리포트 분석기</h2>
            {/* --- ⭐️ [수정] UI 변경: 날짜와 과목 선택 --- */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label htmlFor="dateInput" className="block text-sm font-medium text-gray-700 mb-1">시험 날짜 (필수)</label>
                    <input type="date" id="dateInput" className="w-full px-4 py-2 border border-gray-300 rounded-lg" value={isoDate} onChange={handleDateChange} />
                </div>
                <div>
                    <label htmlFor="subjectSelect" className="block text-sm font-medium text-gray-700 mb-1">시험 범위 (필수)</label>
                    <select id="subjectSelect" className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                            value={selectedSubjectKey}
                            onChange={(e) => setSelectedSubjectKey(e.target.value)}
                    >
                        {/* ⭐️ [수정] 하드코딩된 목록 */}
                        {subjectOptions.map(subject => (
                            <option key={subject.key} value={subject.key}>
                                {subject.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <p className="text-center text-gray-600 mb-6">
                분석할 **PDF 시험지 파일**을 업로드하고, 성적표 입력 방식을 선택해주세요.
            </p>

            <div className={`p-6 border-2 border-dashed rounded-xl transition-colors mb-4 ${ isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400' }`} onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <div className="flex flex-col items-center justify-center space-y-3">
                    <UploadCloud size={30} className={`text-gray-400 transition-colors ${isDragging ? 'text-indigo-600' : ''}`} />
                    <p className={`text-lg font-semibold transition-colors ${isDragging ? 'text-indigo-600' : 'text-gray-500'}`}>PDF 시험지 파일을 여기에 드래그하거나</p>
                    <label htmlFor="fileInput" className="btn btn-primary cursor-pointer max-w-xs">
                        <span>{selectedFiles.some(f => f.name.endsWith('.pdf')) ? 'PDF 파일 선택됨' : 'PDF 파일 선택하기'}</span>
                    </label>
                    <input type="file" id="fileInput" ref={fileInputRef} className="hidden" multiple 
                           accept=".pdf,.csv,.xlsx" 
                           onChange={handleFileChange} />
                </div>
            </div>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">성적표 입력 방식 (필수)</label>
                <div className="flex justify-center gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="inputType" value="file" checked={inputType === 'file'} onChange={() => setInputType('file')} className="radio radio-primary"/>
                        <span className="label-text">엑셀/CSV 파일 업로드</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input type="radio" name="inputType" value="direct" checked={inputType === 'direct'} onChange={() => setInputType('direct')} className="radio radio-primary"/>
                        <span className="label-text">정오표 직접 입력</span>
                    </label>
                </div>
            </div>
            
            {inputType === 'file' && (
                <div className="mb-4">
                    <p className="text-center text-gray-600 mb-4">
                        (파일 이름에 **반 이름**이 포함된 PDF와 엑셀/CSV 파일을 함께 선택해주세요)
                    </p>
                    {selectedFiles.length > 0 && (
                        <div id="fileListContainer" className="mb-4">
                            <h4 className="font-semibold mb-2 text-gray-600">선택된 파일:</h4>
                            <ul id="fileList" className="list-disc list-inside bg-gray-50 p-4 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
                                {selectedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            
            {inputType === 'direct' && (
                <div className="mb-4 p-4 border rounded-lg bg-gray-50 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="directClassName" className="block text-sm font-medium text-gray-700 mb-1">반 이름 (필수)</label>
                            <input type="text" id="directClassName" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                   value={directClassName} onChange={(e) => setDirectClassName(e.target.value)} placeholder="예: 고1A반"/>
                        </div>
                        <div>
                            <label htmlFor="directQuestionCount" className="block text-sm font-medium text-gray-700 mb-1">총 문항 수 (필수)</label>
                            <input type="number" id="directQuestionCount" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                   value={directQuestionCount} onChange={(e) => setDirectQuestionCount(parseInt(e.target.value))} min="1"/>
                        </div>
                    </div>
                    
                    <form onSubmit={handleAddStudent} className="space-y-3 p-3 border-t">
                        <h4 className="font-semibold text-gray-700">학생 추가</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input type="text" placeholder="학생 이름" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                   value={directForm.name} onChange={(e) => setDirectForm(f => ({...f, name: e.target.value}))}/>
                            <input type="number" placeholder="총점" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                   value={directForm.score} onChange={(e) => setDirectForm(f => ({...f, score: e.target.value}))}/>
                            <input type="text" placeholder="정답 (예: O,X,O,X...)" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                   value={directForm.answers} onChange={(e) => setDirectForm(f => ({...f, answers: e.target.value}))}/>
                        </div>
                        <button type="submit" className="btn btn-secondary btn-sm w-full">학생 추가</button>
                    </form>
                    
                    {directStudents.length > 0 && (
                        <div className="overflow-x-auto max-h-48 border-t pt-2">
                             <table className="table table-zebra table-xs w-full">
                                <thead>
                                    <tr>
                                        <th>이름</th>
                                        <th>총점</th>
                                        <th>정답(1~{directQuestionCount})</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {directStudents.map((student, index) => (
                                        <tr key={index}>
                                            <td>{student["이름"]}</td>
                                            <td>{student["총점"]}</td>
                                            <td className="truncate max-w-xs">
                                                {Array.from({ length: directQuestionCount }, (_, i) => student[i + 1]).join(', ')}
                                            </td>
                                            <td>
                                                <button onClick={() => handleRemoveStudent(index)} className="btn btn-ghost btn-xs text-red-500">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}


            {errorMessage && ( <div id="error-message" className="text-red-600 bg-red-100 p-3 rounded-lg mb-4 text-sm" dangerouslySetInnerHTML={{ __html: errorMessage.replace(/\n/g, '<br>') }} /> )}
            
            <button id="processBtn" className="btn btn-primary w-full text-lg" 
                    disabled={processing} // ⭐️ isMigrating 제거
                    onClick={onProcessStart}>
                {processing && <span id="loader" className="spinner" style={{ borderColor: 'white', borderBottomColor: 'transparent', width: '20px', height: '20px', marginRight: '8px' }}></span>}
                <span>{processing ? '분석 중...' : '분석 시작하기'}</span>
            </button>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
                <button className="btn btn-primary w-full text-md" onClick={handleViewExistingByDate} disabled={processing}><CalendarDays size={18} className="mr-2" /> 선택 날짜 조회</button>
                <button className="btn btn-secondary w-full text-md" onClick={() => { setErrorMessage(''); showPage('page3'); }} disabled={processing}>모든 날짜 보기</button>
            </div>
            
            {/* ⭐️ [제거] 마이그레이션 버튼 코드 제거됨 */}
        </div>
    );
};

// ... (Page2_ClassSelect, Page3_DateSelect 컴포넌트는 이전과 동일) ...
const Page2_ClassSelect = ({ handleDeleteClass, selectedDate, handleSelectReport }) => { 
    const { reportSummaries, setSelectedClass, showPage, setSelectedReportId } = useReportContext();
    const classesForDate = reportSummaries
        .filter(r => r.date === selectedDate)
        .map(r => r.className);
    const uniqueClasses = [...new Set(classesForDate)]; 

    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6">{selectedDate} - 반 선택</h2>
            <div id="classButtons" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {uniqueClasses.length > 0 ? (
                    uniqueClasses.map(className => (
                        <div key={className} className="relative flex w-full">
                            <button 
                                className="btn btn-secondary w-full text-left pr-12" 
                                onClick={() => {
                                    const report = reportSummaries.find(r => r.date === selectedDate && r.className === className);
                                    if (report) {
                                        setSelectedReportId(report.id);
                                        setSelectedClass(className);
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
const Page3_DateSelect = ({ handleDeleteDate }) => { 
    const { reportSummaries, setSelectedDate, showPage } = useReportContext();
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
                                    showPage('page2'); 
                                }}
                            >
                                {date}
                            </button>
                            <button 
                                className="absolute right-1 top-1 bottom-1 btn btn-secondary h-auto px-2 text-red-500 hover:bg-red-100 hover:border-red-300" 
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    handleDeleteDate(date); 
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

// ... (AddStudentModal 컴포넌트 수정) ...
const AddStudentModal = ({ isOpen, onClose, onSubmit, questionCount, setErrorMessage }) => {
    if (!isOpen) return null;

    const [form, setForm] = useState({ name: '', score: '', answers: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrorMessage('');
        
        const { name, score, answers } = form;

        if (!name || !score || !answers || questionCount <= 0) {
            setErrorMessage('이름, 총점, 정답을 모두 입력해야 합니다.');
            return;
        }
        
        const answerArray = answers.trim().toUpperCase().split(/[\s,]+/);

        if (answerArray.length !== questionCount) {
            setErrorMessage(`정답 개수(${answerArray.length}개)가 총 문항 수(${questionCount}개)와 일치하지 않습니다.`);
            return;
        }

        // ⭐️ [수정] 'fileParser'가 이해하는 "원본" 객체 생성
        const rawStudent = {
            "이름": name,
            "총점": parseFloat(score),
        };
        
        answerArray.forEach((ans, index) => {
            rawStudent[index + 1] = ans; // "1": "O", "2": "X"
        });

        onSubmit(rawStudent); // ⭐️ App.jsx의 핸들러로 "원본" 학생 객체 전달
        onClose(); // 모달 닫기
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 flex justify-center items-center">
            <div className="card w-full max-w-lg bg-white p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-bold text-center mb-6">학생 추가</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="studentName" className="block text-sm font-medium text-gray-700">학생 이름</label>
                        <input type="text" id="studentName" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                               value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} required/>
                    </div>
                    <div>
                        <label htmlFor="studentScore" className="block text-sm font-medium text-gray-700">총점</label>
                        <input type="number" id="studentScore" className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                               value={form.score} onChange={(e) => setForm(f => ({...f, score: e.target.value}))} required/>
                    </div>
                    <div>
                        <label htmlFor="studentAnswers" className="block text-sm font-medium text-gray-700">
                            문항별 정답 ({questionCount}개)
                        </label>
                        <textarea id="studentAnswers" className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24"
                                  placeholder="O, X, O, O..."
                                  value={form.answers} onChange={(e) => setForm(f => ({...f, answers: e.target.value}))} required/>
                        <p className="text-xs text-gray-500 mt-1">
                            총 {questionCount}개의 문항에 대한 정답(O) 또는 오답(X)을 쉼표(,) 또는 공백으로 구분하여 입력하세요.
                        </p>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
                        <button type="submit" className="btn btn-primary">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ... (Page4_ReportSelect 컴포넌트 수정) ...
const Page4_ReportSelect = ({ handleDeleteStudent, selectedClass, selectedDate, handleSelectReport, handleAddStudent }) => { 
    const { currentReportData, selectedStudent, setSelectedStudent, showPage, selectedReportId, setErrorMessage } = useReportContext();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const students = currentReportData?.students || [];
    const questionCount = currentReportData?.questionCount || 0;
    
    return (
        <>
            <AddStudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddStudent} // ⭐️ App.jsx의 handleAddStudent 전달
                questionCount={questionCount}
                setErrorMessage={setErrorMessage} 
            />
            
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-center">리포트 선택</h2>
                    <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <PlusCircle size={16} className="mr-2" />
                        학생 추가
                    </button>
                </div>
                
                <div id="reportSelectionButtons" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    
                    <button 
                        className={`btn btn-secondary w-full ${selectedStudent === null ? 'btn-nav-active' : ''}`}
                        onClick={() => { 
                            setSelectedStudent(null); 
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
                                    handleSelectReport(selectedReportId, 'page5'); 
                                }}
                            >
                                {student.name}
                            </button>
                            <button 
                                className="absolute right-1 top-1 bottom-1 btn btn-secondary h-auto px-2 text-red-500 hover:bg-red-100 hover:border-red-300"
                                onClick={(e) => {
                                    e.stopPropagation();
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
        </>
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

// --- ⭐️ [제거] 과목 관리 페이지 컴포넌트 ---
// const Page6_SubjectManagement = ({ ... }) => { ... };


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
        
        // ⭐️ [제거] 과목 상태 제거
    } = useReportContext();
    
    const [isAuthenticating, setIsAuthenticating] = useState(true); 
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    // ⭐️ [제거] 마이그레이션 상태 제거
    // const [isMigrating, setIsMigrating] = useState(false);

    const { fileInputRef, handleFileChange, handleFileProcess, handleFileDrop } = useFileProcessor();
    const { goBack, goHome } = useReportNavigation();
    
    useReportGenerator(); 
    const { handlePdfSave } = useChartAndPDF(); 
    
    // (네트워크 모니터링, 익명 인증 useEffect는 변경 없음)
    useEffect(() => {
        // ...
    }, [setErrorMessage]); 

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
    
    // ⭐️ [수정] 'performSuccessfulLogin' (과목 로드 로직 제거)
    const performSuccessfulLogin = async (teacher) => {
        setCurrentTeacher(teacher); 
        setInitialLoading(true); 
        
        try {
            // ⭐️ [수정] 리포트 요약만 불러옴
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
        // setSubjects([]); // ⭐️ [제거]
        resetSelections(); 
        showPage('page1');
        setErrorMessage('');
    };
    
    // (loadAndShowReport 핸들러는 변경 없음)
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

    
    // (handleDeleteDate, handleDeleteClass 핸들러는 변경 없음)
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

    // (handleDeleteStudent 핸들러는 변경 없음)
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
    
    // ⭐️ [수정] 'handleAddStudent' 핸들러 (로직 중앙집중화)
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


    // ⭐️ [제거] handleMigration 함수 제거
    
    // ⭐️ [수정] renderNav (과목 관리 버튼 제거)
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
                        {/* ⭐️ [제거] 과목 관리 버튼 */}
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
        
        // ⭐️ [수정] 'renderPage' 스위치 (Page6 제거)
        switch (currentPage) {
            case 'page1': 
                return <Page1_Upload 
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess} 
                            fileInputRef={fileInputRef}
                            selectedFiles={selectedFiles} 
                            handleFileDrop={handleFileDrop}
                            // ⭐️ [제거] 마이그레이션 관련 props 제거
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
            // ⭐️ [제거] Page6 케이스
            default:
                return <Page1_Upload 
                            handleFileChange={handleFileChange}
                            handleFileProcess={handleFileProcess} 
                            fileInputRef={fileInputRef}
                            selectedFiles={selectedFiles} 
                            handleFileDrop={handleFileDrop}
                            // ⭐️ [제거] 마이그레이션 관련 props 제거
                        />;
        }
    };

    const renderGlobalError = () => {
        if (!errorMessage || currentPage === 'page1') return null; 
        return ( <div id="global-error-message" /* ... */ > </div> );
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