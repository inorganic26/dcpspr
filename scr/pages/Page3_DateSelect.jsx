// scr/pages/Page3_DateSelect.jsx

import React from 'react';
import { useReportContext } from '../context/ReportContext';
import { Trash2 } from 'lucide-react';

const Page3_DateSelect = ({ handleDeleteDate }) => { 
    const { reportSummaries, setSelectedDate, showPage } = useReportContext();
    const allDates = new Set(reportSummaries.map(r => r.date));
    const uniqueDates = Array.from(allDates).sort((a, b) => {
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

export default Page3_DateSelect;