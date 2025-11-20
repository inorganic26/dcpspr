// scr/pages/LoginPage.jsx

import React, { useState } from 'react';
import { TriangleAlert } from 'lucide-react';

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

export default LoginPage;