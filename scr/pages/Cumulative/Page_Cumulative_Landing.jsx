// scr/pages/Cumulative/Page_Cumulative_Landing.jsx

import React from 'react';
import { useReportContext } from '../../context/ReportContext';
import { CalendarDays, Users } from 'lucide-react';

const Page_Cumulative_Landing = () => {
    const { reportSummaries, setSelectedClass, showPage, setErrorMessage, setSelectedDates, setSelectedStudent } = useReportContext();
    
    const allClasses = [...new Set(reportSummaries.map(r => r.className))];

    const handleClassSelect = (className, mode) => {
        setErrorMessage('');
        setSelectedClass(className);
        setSelectedDates([]); 
        setSelectedStudent(null); 

        if (mode === 'date_first') {
            showPage('cum_date_select'); 
        } else {
            showPage('cum_student_select'); 
        }
    };

    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-6 text-indigo-800">📈 누적 성적 분석</h2>
            <p className="text-center text-gray-600 mb-8">
                분석할 <strong>반(Class)</strong>을 먼저 선택하고, 분석 방식을 골라주세요.
            </p>
            
            {allClasses.length === 0 ? (
                <div className="text-center text-gray-500 py-8">저장된 데이터가 없어 분석을 시작할 수 없습니다.</div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {allClasses.map(className => (
                        <div key={className} className="border rounded-xl p-6 bg-gray-50 hover:bg-white hover:shadow-md transition-all border-gray-200">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">{className}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button className="btn btn-secondary flex items-center justify-center"
                                    onClick={() => handleClassSelect(className, 'date_first')}
                                >
                                    <CalendarDays size={18} className="mr-2 text-indigo-600" />
                                    <span>① 날짜 먼저 선택</span>
                                </button>
                                <button className="btn btn-secondary flex items-center justify-center"
                                    onClick={() => handleClassSelect(className, 'student_first')}
                                >
                                    <Users size={18} className="mr-2 text-green-600" />
                                    <span>② 학생 먼저 선택</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Page_Cumulative_Landing;