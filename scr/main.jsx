import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ReportProvider } from './context/ReportContext.jsx'; // ⭐️ ReportProvider를 불러옵니다.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* ⭐️ App 컴포넌트 전체를 ReportProvider로 감싸줍니다. */}
    <ReportProvider>
      <App />
    </ReportProvider>
  </React.StrictMode>,
);