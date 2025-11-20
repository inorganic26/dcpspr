// scr/pages/Cumulative/Page_Cumulative_Result.jsx

import React, { useEffect, useRef, useState } from 'react';
import { useReportContext } from '../../context/ReportContext';
import { loadReportDetails } from '../../hooks/useFirebase'; 
import { renderCumulativeScoreChart } from '../../lib/reportUtils';
import { ArrowLeft } from 'lucide-react';
import Chart from 'chart.js/auto'; 

const Page_Cumulative_Result = ({ mode }) => { // mode: 'by_date' or 'by_student'
    const { 
        reportSummaries, selectedClass, selectedDates, setSelectedDates, 
        selectedStudent, setSelectedStudent, 
        initialLoading, setInitialLoading, setErrorMessage, showPage,
        currentTeacher
    } = useReportContext();

    const [studentList, setStudentList] = useState([]);
    const [chartData, setChartData] = useState(null);
    const chartRef = useRef(null);
    const loadedReportsRef = useRef({});
    
    // ⭐️ [최종 수정] 초기 날짜 설정이 완료되었는지 확인하는 플래그 (무한 루프 방지 핵심)
    const isInitialDatesSetRef = useRef(false);
    
    // ⭐️ [수정] availableDates를 useMemo로 안정화합니다.
    const availableDates = React.useMemo(() => {
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


    // ⭐️ [Effect 1: 초기화 로직] - 학생 기준 모드에서 날짜를 딱 한 번 설정합니다.
    useEffect(() => {
        // 1. 'by_student' 모드에서만 실행
        if (mode !== 'by_student' || isInitialDatesSetRef.current) {
            return;
        }

        // 2. availableDates가 로드되었고, 현재 선택된 날짜 목록이 비어있다면 초기화
        if (availableDates.length > 0 && selectedDates.length === 0) {
            // 3. 플래그를 먼저 설정하고 상태를 변경합니다. (무한 루프 방지 핵심)
            isInitialDatesSetRef.current = true;
            setSelectedDates(availableDates);
        }
        
        // 4. 컴포넌트 언마운트 또는 클래스가 변경될 경우 플래그 초기화
        return () => {
             isInitialDatesSetRef.current = false;
        };

    // ⭐️ [Final Dependencies] availableDates 배열 자체의 참조를 사용하여 초기 로드 시에만 실행을 보장합니다.
    }, [mode, availableDates, setSelectedDates, selectedDates.length]);


    // ⭐️ [Effect 2: 데이터 로딩 로직] - 필터 상태에 따라 데이터를 로드합니다.
    useEffect(() => {
        if (!currentTeacher || !selectedClass) return;

        // 1. 데이터 로드 게이트: 날짜가 선택되지 않았으면 로드를 막습니다.
        if (selectedDates.length === 0) {
             setStudentList([]);
             setChartData(null);
             loadedReportsRef.current = {};
             setInitialLoading(false);
             return; 
        }

        const loadData = async () => {
            setInitialLoading(true);
            
            try {
                let targetSummaries = reportSummaries.filter(r => r.className === selectedClass);
                
                // ⭐️ 선택된 날짜(selectedDates)를 기반으로 리포트 요약을 필터링합니다.
                targetSummaries = targetSummaries.filter(r => selectedDates.includes(r.date));

                const studentsSet = new Set();
                const loadedReports = {}; 

                for (const reportInfo of targetSummaries) {
                    const detail = await loadReportDetails(reportInfo.id);
                    loadedReports[reportInfo.date] = detail;
                    detail.students.forEach(s => studentsSet.add(s.name));
                }
                
                const sortedStudents = Array.from(studentsSet).sort();
                setStudentList(sortedStudents);
                
                loadedReportsRef.current = loadedReports; 

            } catch (error) {
                setErrorMessage("데이터 로드 중 오류: " + error.message);
            } finally {
                setInitialLoading(false);
            }
        };
        
        loadData();

    // ⭐️ [Final Dependencies] selectedDates 배열의 길이(참조 대신)가 변경될 때만 로드를 수행합니다.
    }, [currentTeacher, selectedClass, selectedDates.length, reportSummaries, setInitialLoading, setErrorMessage, loadReportDetails]);
    
    
    // C. 차트 렌더링 (selectedStudent나 chartData가 변경될 때 실행)
    useEffect(() => {
        if (chartData && selectedStudent && chartRef.current) {
            const existingChart = Chart.getChart(chartRef.current);
            if (existingChart) existingChart.destroy();

            renderCumulativeScoreChart(chartRef.current, chartData, selectedStudent);
        }
    }, [chartData, selectedStudent]);

    // D. 날짜 선택 모드일 때, 결과 페이지 진입 후 학생 선택 리셋
    useEffect(() => {
        if (mode === 'by_date') {
            setSelectedStudent(null);
            setChartData(null);
        }
    }, [mode]);


    // B. 학생 선택 시 차트 데이터 생성
    const handleStudentSelect = (name) => {
        setSelectedStudent(name);
        const reports = loadedReportsRef.current;
        
        const dataPoints = [];
        
        // 날짜순으로 정렬
        const dates = Object.keys(reports).sort((a, b) => {
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
        
        dates.forEach(date => {
            const report = reports[date];
            const studentData = report.students.find(s => s.name === name);
            
            // 로드된 데이터(loadedReportsRef)는 이미 필터링되어 있으므로, studentData만 확인합니다.
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

    // E. 날짜 필터 UI (학생 먼저 선택 모드에서만 사용)
    const handleToggleDate = (date) => {
        let newSelectedDates;
        if (selectedDates.includes(date)) {
             newSelectedDates = selectedDates.filter(d => d !== date);
        } else {
             newSelectedDates = [...selectedDates, date];
        }
        
        // ⭐️ selectedDates를 업데이트합니다.
        setSelectedDates(newSelectedDates);

        // ⭐️ [수정] 날짜 필터 변경 후 학생 선택을 해제하여 데이터 로딩 Effect가 완료되기를 기다립니다.
        if (selectedStudent) {
            setSelectedStudent(null); 
            setChartData(null); 
        }
    };
    
    
    if (initialLoading) {
        return (
            <div id="initialLoader" className="card p-8 text-center mt-20">
                <div className="spinner mx-auto"></div>
                <p className="mt-4 text-gray-600">누적 데이터를 로드 중입니다...</p>
            </div>
        );
    }
    
    return (
        <div className="card">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{selectedClass} - 성적 추이 분석</h2>
                <span className="badge badge-primary p-3">{mode === 'by_date' ? '날짜 기준' : '학생 기준'}</span>
            </div>
            
            {/* 1. 날짜 필터 영역 (학생 기준 모드에서만) */}
            {mode === 'by_student' && (
                <div className="mb-6 p-4 border rounded-lg bg-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">① 분석 날짜 필터 (선택 사항)</label>
                    <p className="text-xs text-gray-500 mb-2">선택을 해제하면 해당 날짜는 차트에서 제외됩니다.</p>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {availableDates.map(date => (
                             <button 
                                key={date}
                                onClick={() => handleToggleDate(date)}
                                className={`btn btn-sm ${selectedDates.includes(date) ? 'btn-primary' : 'btn-outline btn-secondary'}`}
                            >
                                {date}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            

            {/* 2. 학생 선택 영역 */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">② 분석할 학생 선택</label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded bg-gray-50">
                    {studentList.length === 0 ? (
                        <p className="text-gray-500 text-sm">해당 시험을 응시한 학생이 없습니다.</p>
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

            {/* 3. 차트 영역 */}
            {selectedStudent && chartData && (
                <div className="mb-6 p-4 border rounded-xl bg-white shadow-sm">
                    <canvas ref={chartRef} id="cumulativeChart"></canvas>
                    {chartData.length < 2 && (
                        <p className="text-center text-red-500 text-sm mt-2">
                            * 데이터 포인트가 2개 이상이어야 추세선이 보입니다. (현재: {chartData.length}개)
                        </p>
                    )}
                </div>
            )}
            
            {/* 4. 데이터 테이블 */}
            {selectedStudent && chartData && chartData.length > 0 && (
                <div className="overflow-x-auto mb-6">
                     <table className="table table-sm w-full text-center">
                        <thead>
                            <tr className="bg-gray-100">
                                <th>날짜</th>
                                <th>{selectedStudent} 점수</th>
                                <th>반 평균</th>
                                <th>차이</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((d, idx) => (
                                <tr key={idx} className="hover">
                                    <td>{d.date}</td>
                                    <td className="font-bold text-blue-600">{d.studentScore}</td>
                                    <td className="text-gray-500">{d.classAverage}</td>
                                    <td className={d.studentScore >= d.classAverage ? "text-green-600" : "text-red-500"}>
                                        {d.studentScore - d.classAverage > 0 ? '+' : ''}{(d.studentScore - d.classAverage).toFixed(1)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="flex justify-start">
                <button className="btn btn-secondary" 
                    onClick={() => {
                        showPage(mode === 'by_date' ? 'cum_date_select' : 'cum_landing');
                        setSelectedStudent(null);
                        setChartData(null);
                    }}>
                    <ArrowLeft size={16} className="mr-2"/> 뒤로 가기
                </button>
            </div>
        </div>
    );
};

export default Page_Cumulative_Result;