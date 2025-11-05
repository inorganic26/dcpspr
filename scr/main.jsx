// scr/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ReportProvider } from './context/ReportContext.jsx';

// ⭐️ [수정] PDF.js 워커 설정 추가
// ⭐️ [수정] 끝

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ReportProvider>
      <App />
    </ReportProvider>
  </React.StrictMode>,
);