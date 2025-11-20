// scr/pages/Page2_ClassSelect.jsx

import React from 'react';
import { useReportContext } from '../context/ReportContext';
import { Trash2 } from 'lucide-react';

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

export default Page2_ClassSelect;