// scr/pages/Page4_ReportSelect.jsx

import React, { useState } from 'react';
import { useReportContext } from '../context/ReportContext';
import { PlusCircle, Trash2 } from 'lucide-react';
import AddStudentModal from '../components/AddStudentModal'; // 분리된 컴포넌트 임포트

const Page4_ReportSelect = ({ handleDeleteStudent, selectedClass, selectedDate, handleSelectReport, handleAddStudent }) => { 
    const { currentReportData, selectedStudent, setSelectedStudent, selectedReportId, setErrorMessage } = useReportContext();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const students = currentReportData?.students || [];
    const questionCount = currentReportData?.questionCount || 0;
    
    return (
        <>
            <AddStudentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddStudent} 
                questionCount={questionCount}
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

export default Page4_ReportSelect;