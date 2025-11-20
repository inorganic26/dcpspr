// scr/pages/Page5_ReportDisplay.jsx

import React, { useEffect } from 'react';
import { useReportContext } from '../context/ReportContext';
import { usePagination } from '../hooks/usePagination';
import renderMathInElement from 'katex/dist/contrib/auto-render';

const Page5_ReportDisplay = () => { 
    const { reportHTML } = useReportContext();
    const reportContentRef = usePagination(); 

    // ⭐️ [수정] reportHTML이 변경될 때마다 KaTeX 렌더링 실행
    useEffect(() => {
        if (reportContentRef.current) {
            try {
                // KaTeX의 auto-render 기능 실행
                renderMathInElement(reportContentRef.current, {
                    delimiters: [
                        {left: "$$", right: "$$", display: true},
                        {left: "\\[", right: "\\]", display: true},
                        {left: "$", right: "$", display: false},
                        {left: "\\(", right: "\\)", display: false}
                    ],
                    // 오류 발생 시 콘솔에 로그
                    strict: (errorCode, errorMsg, token) => {
                        console.warn(`KaTeX parsing error: ${errorCode} - ${errorMsg}`, token);
                        return 'warn';
                    }
                });
            } catch (error) {
                console.error("KaTeX 렌더링 중 오류 발생:", error);
            }
        }
    }, [reportHTML, reportContentRef]); // reportHTML이 렌더링 된 후 실행

    return (
        <div id="reportContainer" ref={reportContentRef} >
            <div id="reportContent" className="space-y-6" dangerouslySetInnerHTML={{ __html: reportHTML }} />
            <div id="pagination-controls" className="flex justify-center items-center space-x-4 mt-4 print:hidden" style={{ display: 'none' }}>
                <button id="prevPageBtn" className="btn btn-secondary">&lt; 이전</button>
                <span id="pageIndicator">1 / 3</span>
                <button id="nextPageBtn" className="btn btn-secondary">다음 &gt;</button>
            </div>
        </div>
    );
};

export default Page5_ReportDisplay;