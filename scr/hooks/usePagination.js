import { useEffect, useRef } from 'react';
import { useReportContext } from '../context/ReportContext';

export const usePagination = () => {
    const {
        currentPage, reportCurrentPage, setReportCurrentPage, 
        reportHTML, aiLoading,
    } = useReportContext();
    const reportContentRef = useRef(null);

    useEffect(() => {
        const contentEl = reportContentRef.current;
        if (currentPage !== 'page5' || !contentEl || aiLoading) return;

        const pages = contentEl.querySelectorAll('.report-page');
        const indicator = contentEl.querySelector('#pageIndicator');
        const prevBtn = contentEl.querySelector('#prevPageBtn');
        const nextBtn = contentEl.querySelector('#nextPageBtn');
        const controls = contentEl.querySelector('#pagination-controls');

        if (!indicator || !prevBtn || !nextBtn || !controls) return;
        
        const updateView = (pageIndex) => {
            pages.forEach((page, index) => {
                page.style.display = (index === pageIndex - 1) ? 'block' : 'none';
            });
            indicator.textContent = `${pageIndex} / ${pages.length}`;
            prevBtn.disabled = pageIndex === 1;
            nextBtn.disabled = pageIndex === pages.length;
            controls.style.display = pages.length > 1 ? 'flex' : 'none';
        };
        
        updateView(reportCurrentPage);

        const onPrev = () => setReportCurrentPage(p => (p > 1 ? p - 1 : p));
        const onNext = () => setReportCurrentPage(p => (p < pages.length ? p + 1 : p));

        // ⭐️ 이벤트 리스너 중복 방지를 위해 기존 핸들러를 제거하고 새로 할당합니다.
        prevBtn.onclick = null;
        nextBtn.onclick = null;
        prevBtn.onclick = onPrev;
        nextBtn.onclick = onNext;

    }, [currentPage, reportCurrentPage, reportHTML, aiLoading, setReportCurrentPage]);

    return reportContentRef; // JSX에서 사용할 ref 반환
};