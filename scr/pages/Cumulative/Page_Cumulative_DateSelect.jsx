// scr/pages/Cumulative/Page_Cumulative_DateSelect.jsx

import React from 'react';
import { useReportContext } from '../../context/ReportContext';
import { ArrowLeft, CheckSquare } from 'lucide-react';

const Page_Cumulative_DateSelect = ({ nextStep }) => {
    const { reportSummaries, selectedClass, selectedDates, setSelectedDates, showPage, setErrorMessage } = useReportContext();

    const availableDates = reportSummaries
        .filter(r => r.className === selectedClass)
        .map(r => r.date)
        .sort((a, b) => {
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

    const toggleDate = (date) => {
        if (selectedDates.includes(date)) {
            setSelectedDates(selectedDates.filter(d => d !== date));
        } else {
            setSelectedDates([...selectedDates, date].sort());
        }
    };

    const handleNext = () => {
        if (selectedDates.length === 0) {
            setErrorMessage("최소 1개 이상의 날짜를 선택해주세요.");
            return;
        }
        setErrorMessage('');
        showPage(nextStep); // 'cum_result_by_date'
    };

    return (
        <div className="card">
            <h2 className="text-2xl font-bold text-center mb-4">{selectedClass} - 날짜 선택 (다중)</h2>
            <p className="text-center text-gray-600 mb-6">분석에 포함할 시험 날짜를 모두 선택해주세요.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8 max-h-80 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                {availableDates.map(date => (
                    <div key={date} 
                         onClick={() => toggleDate(date)}
                         className={`cursor-pointer p-3 rounded-lg border text-center transition-all ${selectedDates.includes(date) ? 'bg-indigo-100 border-indigo-500 text-indigo-700 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                        <div className="flex items-center justify-center space-x-2">
                            <CheckSquare size={16} className={selectedDates.includes(date) ? "text-indigo-600" : "text-gray-300"} />
                            <span>{date}</span>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="flex justify-between">
                <button className="btn btn-secondary" onClick={() => showPage('cum_landing')}>이전</button>
                <button className="btn btn-primary" onClick={handleNext} disabled={selectedDates.length === 0}>
                    다음 (학생 선택)
                </button>
            </div>
        </div>
    );
};

export default Page_Cumulative_DateSelect;