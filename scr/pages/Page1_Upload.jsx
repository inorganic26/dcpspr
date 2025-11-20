// scr/pages/Page1_Upload.jsx

import React, { useEffect, useState } from 'react';
import { useReportContext } from '../context/ReportContext';
import { UploadCloud, CalendarDays, Trash2, LineChart } from 'lucide-react';
import { useFileProcessor } from '../hooks/useFileProcessor';


const Page1_Upload = () => { 
    const { 
        processing, errorMessage, uploadDate, setUploadDate, showPage, 
        reportSummaries, setSelectedDate, setErrorMessage,
        selectedFiles, setSelectedFiles
    } = useReportContext();
    
    // useFileProcessor 훅에서 필요한 함수들을 가져옵니다.
    const { fileInputRef, handleFileChange, handleFileProcess, handleFileDrop } = useFileProcessor();

    const [isDragging, setIsDragging] = useState(false); 
    
    const [inputType, setInputType] = useState('file'); 
    const [directClassName, setDirectClassName] = useState('');
    const [directQuestionCount, setDirectQuestionCount] = useState(20);
    const [directStudents, setDirectStudents] = useState([]);
    const [directForm, setDirectForm] = useState({ name: '', score: '', answers: '' });
    
    const [selectedSubjectKey, setSelectedSubjectKey] = useState(''); 

    // ⭐️ [신규] 하드코딩된 과목 목록 (App.jsx에서 이동)
    const subjectOptions = [
        { key: 'MID_3', label: '중학교 3학년 과정' },
        { key: 'HIGH_1_1', label: '고1 공통수학 1' },
        { key: 'HIGH_1_2', label: '고1 공통수학 2' },
        { key: 'HIGH_1_MIXED', label: '고1 혼합 (공통수학 1+2)' },
        { key: 'HIGH_2_SU1', label: '고2 수1' },
        { key: 'HIGH_2_SU2', label: '고2 수2' },
        { key: 'HIGH_2_DAESU', label: '고2 대수 (수1+수2)' },
    ];

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (!isDragging) setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDropInternal = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileDrop(e.dataTransfer.files); e.dataTransfer.clearData();
        }
    };
    
    // 날짜 처리 헬퍼 함수들 (App.jsx에서 이동)
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

    // --- '분석 시작하기' 버튼 클릭 핸들러 ---
    const onProcessStart = () => {
        if (!selectedSubjectKey) {
            setErrorMessage('시험 범위를 선택해야 AI가 정확한 유형을 분석할 수 있습니다.');
            return;
        }
        
        // App.jsx에서 내려받은 handleFileProcess 호출
        handleFileProcess(inputType, {
            className: directClassName,
            students: directStudents,
        }, selectedSubjectKey); 
    };

    return (
        <div id="fileUploadCard" className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">AI 성적 리포트 분석기</h2>
            {/* --- ⭐️ UI 변경: 날짜와 과목 선택 --- */}
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
                        <option value="" disabled>-- 시험 범위를 선택하세요 --</option>
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

            <div className={`p-6 border-2 border-dashed rounded-xl transition-colors mb-4 ${ isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400' }`} onDragOver={handleDragOver} onDragEnter={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDropInternal}>
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
                    disabled={processing}
                    onClick={onProcessStart}>
                {processing && <span id="loader" className="spinner" style={{ borderColor: 'white', borderBottomColor: 'transparent', width: '20px', height: '20px', marginRight: '8px' }}></span>}
                <span>{processing ? '분석 중...' : '분석 시작하기'}</span>
            </button>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
                <button className="btn btn-primary w-full text-md" onClick={handleViewExistingByDate} disabled={processing}><CalendarDays size={18} className="mr-2" /> 선택 날짜 조회</button>
                <button className="btn btn-secondary w-full text-md" onClick={() => { setErrorMessage(''); showPage('page3'); }} disabled={processing}>모든 날짜 보기</button>
            </div>
            
            {/* ⭐️ [신규] 누적 성적 분석 버튼 */}
            <div className="mt-4 border-t pt-4">
                <button className="btn btn-accent w-full text-lg" onClick={() => { setErrorMessage(''); showPage('cum_landing'); }} disabled={processing}>
                    <LineChart size={20} className="mr-2" /> 누적 성적 분석 (추이 보기)
                </button>
            </div>
        </div>
    );
};

export default Page1_Upload;