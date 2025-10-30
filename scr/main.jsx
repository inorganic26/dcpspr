import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// 추가적인 글로벌 CSS 파일이 필요하면 여기에 import 합니다. (예: import './index.css';)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

