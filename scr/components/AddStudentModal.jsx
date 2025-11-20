// scr/components/AddStudentModal.jsx

import React, { useState } from 'react';
import { useReportContext } from '../context/ReportContext';

const AddStudentModal = ({ isOpen, onClose, onSubmit, questionCount }) => {
    // context에서 setErrorMessage만 사용
    const { setErrorMessage } = useReportContext(); 
    
    if (!isOpen) return null;

    const [form, setForm] = useState({ name: '', score: '', answers: '' });

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrorMessage('');
        
        const { name, score, answers } = form;

        if (!name || !score || !answers || questionCount <= 0) {
            setErrorMessage('이름, 총점, 총 문항 수, 정답을 모두 입력해야 합니다.');
            return;
        }
        
        const answerArray = answers.trim().toUpperCase().split(/[\s,]+/);

        if (answerArray.length !== questionCount) {
            setErrorMessage(`정답 개수(${answerArray.length}개)가 총 문항 수(${questionCount}개)와 일치하지 않습니다.`);
            return;
        }

        const rawStudent = {
            "이름": name,
            "총점": parseFloat(score),
        };
        
        answerArray.forEach((ans, index) => {
            rawStudent[index + 1] = ans; 
        });

        onSubmit(rawStudent); 
        onClose(); 
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

export default AddStudentModal;