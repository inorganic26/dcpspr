// scr/pages/Cumulative/Page_Cumulative_Result.jsx

import React, { useEffect, useRef, useState } from 'react';
import { useReportContext } from '../../context/ReportContext';
import { loadReportDetails } from '../../hooks/useFirebase'; 
import { renderCumulativeScoreChart } from '../../lib/reportUtils';
import { ArrowLeft, CheckSquare, Square, Search } from 'lucide-react'; 
import Chart from 'chart.js/auto'; 

const Page_Cumulative_Result = ({ mode }) => { 
    const { 
        reportSummaries, selectedClass, selectedDates, setSelectedDates, 
        selectedStudent, setSelectedStudent, 
        setErrorMessage, showPage, currentTeacher
    } = useReportContext();

    const [isLoading, setIsLoading] = useState(false);
    const [studentList, setStudentList] = useState([]);
    const [chartData, setChartData] = useState(null);
    const chartRef = useRef(null);
    const loadedReportsRef = useRef({});
    
    // ⭐️ [안전장치] 초기화가 이미 실행되었는지 체크하는 변수
    const initializedRef = useRef(false);
    
    // 1. 이 반의 '전체 가능한 날짜' 목록 계산
    const availableDates = React.useMemo(() => {
        if (!selectedClass) return [];
        return [...new Set(reportSummaries.filter(r => r.className === selectedClass).map(r => r.date))].sort((a, b) => {
            const convertToComparable = (dateStr) => {
                const match = dateStr.match(/(\d+)월 (\d+)일/);
                if (match) {
                    const year = new Date().getFullYear();
                    const month = match[1].padStart(2, '0');
                    const day = match[2].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
                return dateStr;
            };
            return convertToComparable(a).localeCompare(convertToComparable(b));
        });
    }, [reportSummaries, selectedClass]);


    // ⭐️ [수정 1] 강력한 초기화 로직 (딱 한 번만 실행됨)
    useEffect(() => {
        // 데이터가 없거나, 이미 초기화를 한 적이 있다면(initializedRef.current === true) 실행하지 않음
        if (availableDates.length === 0 || initializedRef.current) return;

        // '학생 기준' 모드일 때만 전체 선택 (날짜 기준은 앞 페이지 선택 존중)
        if (mode === 'by_student') {
            // 기존 선택이 없으면 전체 선택
            if (selectedDates.length === 0) {
                setSelectedDates(availableDates);
            }
            // ⭐️ "나 이제 초기화 했어!" 도장 쾅 (다시는 실행 안 됨)
            initializedRef.current = true;
        } 
        // '날짜 기준' 모드일 때도 초기화 완료 처리
        else if (mode === 'by_date') {
            if (selectedDates.length === 0) setSelectedDates(availableDates);
            initializedRef.current = true;
        }
        
    }, [mode, availableDates, selectedDates.length, setSelectedDates]);

    // 반이 바뀌면 초기화 다시 할 수 있게 리셋
    useEffect(() => {
        initializedRef.current = false;
        // 학생 목록이나 차트도 초기화
        setStudentList([]);
        setChartData(null);
    }, [selectedClass]);


    // ⭐️ [수정 2] 데이터 조회 함수 (버튼 클릭 시 실행)
    const handleSearchData = async () => {
        if (!currentTeacher || !selectedClass) return;

        if (selectedDates.length === 0) {
             setErrorMessage("분석할 날짜를 최소 1개 이상 선택해주세요.");
             return; 
        }
        
        if (!selectedStudent) {
            setErrorMessage("분석할 학생을 선택해주세요.");
            return;
        }

        setIsLoading(true);
        setErrorMessage(''); 
        
        try {
            // 선택된 날짜에 해당하는 리포트만 가져오기
            let targetSummaries = reportSummaries.filter(r => r.className === selectedClass);
            targetSummaries = targetSummaries.filter(r => selectedDates.includes(r.date));

            const loadedReports = {}; 

            for (const reportInfo of targetSummaries) {
                const detail = await loadReportDetails(reportInfo.id);
                loadedReports[reportInfo.date] = detail;
            }
            
            loadedReportsRef.current = loadedReports; 
            
            // 차트 그리기
            processChartData(selectedStudent);

        } catch (error) {
            setErrorMessage("데이터 로드 중 오류: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    // 차트 데이터 가공
    const processChartData = (studentName) => {
        const reports = loadedReportsRef.current;
        const dataPoints = [];
        
        const sortedDates = Object.keys(reports).sort((a, b) => {
             const parseDate = (d) => {
                 const m = d.match(/(\d+)월 (\d+)일/);
                 return m ? new Date(2024, m[1]-1, m[2]) : new Date();
             };
             return parseDate(a) - parseDate(b);
        });

        sortedDates.forEach(date => {
            const report = reports[date];
            const studentData = report.students.find(s => s.name === studentName);
            
            if (studentData && studentData.submitted) {
                dataPoints.push({
                    date: date,
                    studentScore: studentData.score,
                    classAverage: parseFloat(report.classAverage)
                });
            }
        });

        setChartData(dataPoints);
    };
    
    // 차트 렌더링
    useEffect(() => {
        if (chartData && selectedStudent && chartRef.current) {
            const existingChart = Chart.getChart(chartRef.current);
            if (existingChart) existingChart.destroy();

            renderCumulativeScoreChart(chartRef.current, chartData, selectedStudent);
        }
    }, [chartData, selectedStudent]);


    // ⭐️ [수정 3] 학생 목록 미리 로드 (UX 개선)
    // 페이지 들어오자마자 가장 최근 리포트 1개만 열어서 학생 명단을 미리 보여줌
    useEffect(() => {
        const fetchStudentList = async () => {
            if (!selectedClass || availableDates.length === 0) return;
            // 이미 목록이 있으면 패스
            if (studentList.length > 0) return;

            try {
                const lastDate = availableDates[availableDates.length - 1];
                const lastSummary = reportSummaries.find(r => r.className === selectedClass && r.date === lastDate);
                
                if (lastSummary) {
                    // 로딩 표시 없이 조용히 가져옴
                    const detail = await loadReportDetails(lastSummary.id);
                    const names = detail.students.map(s => s.name).sort();
                    setStudentList(names);
                }
            } catch (e) {
                console.error("학생 명단 미리보기 로드 실패", e);
            }
        };
        
        fetchStudentList();
    }, [selectedClass, availableDates, reportSummaries]);


    // ⭐️ 날짜 토글 (여기서는 로딩 안 함 -> 체크박스 자유자재)
    const handleToggleDate = (date) => {
        let newSelectedDates;
        if (selectedDates.includes(date)) {
             newSelectedDates = selectedDates.filter(d => d !== date);
        } else {
             newSelectedDates = [...selectedDates, date];
        }
        setSelectedDates(newSelectedDates);
        
        // 날짜 바꾸면 차트 데이터는 초기화 (다시 조회 유도)
        if (chartData) setChartData(null);
    };
    
    // 학생 선택
    const handleStudentSelect = (name) => {
        setSelectedStudent(name);
        if (chartData) setChartData(null); // 학생 바꾸면 다시 조회 유도
    };

    if (isLoading) {
        return (
            <div className="card p-8 text-center mt-20">
                <div className="spinner mx-auto"></div>
                <p className="mt-4 text-gray-600">데이터를 분석하고 있습니다...</p>
            </div>
        );
    }
    
    return (
        <div className="card">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{selectedClass} 누적 분석</h2>
            </div>
            
            {/* 1. 날짜 필터 영역 */}
            <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-bold text-gray-700">
                        📅 1. 분석할 날짜 선택 ({selectedDates.length}개)
                    </label>
                    <div className="space-x-2">
                        <button className="text-xs text-gray-500 underline" onClick={() => setSelectedDates([])}>전체 해제</button>
                        <button className="text-xs text-blue-500 underline" onClick={() => setSelectedDates(availableDates)}>전체 선택</button>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                    {availableDates.map(date => {
                        const isSelected = selectedDates.includes(date);
                        return (
                             <button 
                                key={date}
                                onClick={() => handleToggleDate(date)}
                                className={`btn btn-sm flex items-center space-x-1 transition-colors ${
                                    isSelected 
                                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                                    : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {isSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                                <span>{date}</span>
                            </button>
                        );
                    })}
                </div>
                {selectedDates.length === 0 && (
                    <p className="text-red-500 text-xs mt-2">※ 날짜를 최소 1개 이상 선택해주세요.</p>
                )}
            </div>
            

            {/* 2. 학생 선택 영역 */}
            <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">👤 2. 분석할 학생 선택</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 border rounded-lg bg-gray-50">
                    {studentList.length === 0 ? (
                        <p className="text-gray-500 text-sm p-2">학생 명단을 불러오는 중입니다...</p>
                    ) : (
                        studentList.map(name => (
                            <button 
                                key={name}
                                onClick={() => handleStudentSelect(name)}
                                className={`btn btn-sm ${selectedStudent === name ? 'btn-primary' : 'btn-outline btn-secondary'}`}
                            >
                                {name}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ⭐️ 3. 조회 버튼 */}
            <div className="mb-8 text-center">
                <button 
                    className="btn btn-primary btn-lg w-full md:w-1/2 flex justify-center items-center mx-auto"
                    onClick={handleSearchData}
                    disabled={selectedDates.length === 0 || !selectedStudent}
                >
                    <Search size={20} className="mr-2"/>
                    분석 결과 조회하기
                </button>
                {(!selectedDates.length || !selectedStudent) && (
                    <p className="text-xs text-red-400 mt-2">위에서 날짜와 학생을 모두 선택해야 조회할 수 있습니다.</p>
                )}
            </div>

            {/* 4. 차트 영역 */}
            {chartData && (
                <div className="mb-6 p-4 border rounded-xl bg-white shadow-md animate-fade-in">
                    <div className="flex justify-between mb-2">
                        <h3 className="font-bold text-lg">{selectedStudent} 학생 성적 추이</h3>
                    </div>
                    <div className="relative h-64 w-full">
                        <canvas ref={chartRef} id="cumulativeChart"></canvas>
                    </div>
                    {chartData.length < 2 && (
                        <p className="text-center text-orange-500 text-xs mt-2 bg-orange-50 p-2 rounded">
                            ⚠️ 데이터 포인트가 1개뿐입니다. 2개 이상의 날짜를 선택하면 추세선이 나타납니다.
                        </p>
                    )}
                </div>
            )}
            
            {/* 5. 데이터 테이블 */}
            {chartData && chartData.length > 0 && (
                <div className="overflow-x-auto mb-6 border rounded-lg animate-fade-in">
                     <table className="table table-sm w-full text-center">
                        <thead className="bg-gray-100 text-gray-600">
                            <tr>
                                <th>날짜</th>
                                <th>점수</th>
                                <th>반 평균</th>
                                <th>차이</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((d, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td>{d.date}</td>
                                    <td className="font-bold text-blue-600">{d.studentScore}</td>
                                    <td className="text-gray-500">{d.classAverage}</td>
                                    <td className={`font-medium ${d.studentScore >= d.classAverage ? "text-green-600" : "text-red-500"}`}>
                                        {d.studentScore - d.classAverage > 0 ? '+' : ''}{(d.studentScore - d.classAverage).toFixed(1)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex justify-start mt-8">
                <button className="btn btn-secondary flex items-center" 
                    onClick={() => {
                        showPage('cum_landing'); 
                        setSelectedStudent(null);
                        setChartData(null);
                    }}>
                    <ArrowLeft size={16} className="mr-2"/> 
                    메뉴로 돌아가기
                </button>
            </div>
        </div>
    );
};

export default Page_Cumulative_Result;