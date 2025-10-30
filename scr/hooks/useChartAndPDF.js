import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { renderScoreChart } from '../lib/reportUtils.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Chart from 'chart.js/auto';

export const useChartAndPDF = () => {
    const { 
        currentPage, testData, selectedClass, selectedDate, 
        selectedStudent, aiLoading, reportHTML, 
        activeChart, setActiveChart, setErrorMessage
    } = useReportContext();

    // --- 1. 차트 렌더링 (willReadFrequently 경고 수정) ---
    useEffect(() => {
        let newChart = null;
        
        if (currentPage === 'page5' && !aiLoading && reportHTML) {
            const chartCanvas = document.getElementById('scoreChart');
            const data = testData[selectedClass]?.[selectedDate];
            
            if (chartCanvas && data?.studentData) {
                const existingChart = Chart.getChart(chartCanvas);
                if (existingChart) {
                    existingChart.destroy();
                }

                // ⭐️⭐️⭐️ 변경된 부분 (Canvas 경고 수정) ⭐️⭐️⭐️
                // ⭐️ 캔버스를 읽기 전에 willReadFrequently 속성을 true로 설정
                const ctx = chartCanvas.getContext('2d');
                if (ctx) {
                    ctx.willReadFrequently = true; 
                }
                // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
                
                const studentForChart = data.studentData.students.find(s => s.name === selectedStudent) || null;
                // ⭐️ renderScoreChart에는 캔버스(chartCanvas)를 전달합니다.
                newChart = renderScoreChart(chartCanvas, data.studentData, studentForChart);
                setActiveChart(newChart); // Context에 차트 인스턴스 저장
            }
        }
        
        return () => {
            if (newChart) {
                newChart.destroy();
                setActiveChart(null);
            }
        };
    }, [currentPage, aiLoading, reportHTML, selectedStudent, selectedClass, selectedDate, testData, setActiveChart]); 


    // --- 2. PDF 저장 핸들러 (⭐️ 'UNKNOWN' 오류 수정) ---
    const handlePdfSave = useCallback(async (e) => {
        if (!e.target || (e.target.id !== 'savePdfBtn' && !e.target.closest('#savePdfBtn'))) {
            return;
        }
        const button = e.target.id === 'savePdfBtn' ? e.target : e.target.closest('#savePdfBtn');
        if (!button) return;

        if (!activeChart && document.getElementById('scoreChart')) { 
            setErrorMessage('차트가 렌더링되지 않아 PDF를 저장할 수 없습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        const pdf = new jsPDF('p', 'mm', 'a4');
        const reportType = button.dataset.reportType;
        const studentName = button.dataset.studentName;
        
        button.textContent = '저장 중...';
        button.disabled = true;

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '1000px'; 
        tempContainer.style.backgroundColor = 'white';
        document.body.appendChild(tempContainer);

        const addElementToPdfPage = async (element) => {
            tempContainer.innerHTML = ''; 
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'p-8 bg-white'; 
            
            const clonedElement = element.cloneNode(true);
            
            const chartCanvas = clonedElement.querySelector('canvas#scoreChart');
            if (chartCanvas && activeChart) { 
                // ⭐️ willReadFrequently 경고 수정 (복제된 캔버스에도 적용)
                const ctx = chartCanvas.getContext('2d');
                if(ctx) ctx.willReadFrequently = true;
                
                const chartImg = new Image();
                chartImg.src = activeChart.toBase64Image('image/png', 1.0);
                try { await chartImg.decode(); } catch(e) { console.error("Chart image decode error:", e);}
                chartCanvas.parentNode.replaceChild(chartImg, chartCanvas);
            } else if (chartCanvas) {
                const placeholder = document.createElement('div');
                placeholder.textContent = '차트 데이터 없음';
                placeholder.style.cssText = 'text-align: center; padding: 50px;';
                chartCanvas.parentNode.replaceChild(placeholder, chartCanvas);
            }

            const commentTextArea = clonedElement.querySelector('textarea#instructorComment');
            if (commentTextArea) {
                const currentCommentText = document.getElementById('instructorComment')?.value ?? '';
                const commentParagraph = document.createElement('p');
                commentParagraph.className = 'text-sky-700 whitespace-pre-wrap p-2 border border-sky-300 rounded-lg';
                commentParagraph.textContent = currentCommentText || " ";
                commentTextArea.parentNode.replaceChild(commentParagraph, commentTextArea);
            }

            contentWrapper.appendChild(clonedElement);
            tempContainer.appendChild(contentWrapper);

            try {
                // ⭐️ willReadFrequently 경고 수정 (html2canvas가 생성하는 캔버스)
                const canvasElement = tempContainer.querySelector('canvas');
                if (canvasElement) {
                     const ctx = canvasElement.getContext('2d');
                     if (ctx) ctx.willReadFrequently = true;
                }

                const canvas = await html2canvas(tempContainer, { 
                    scale: 2, 
                    useCORS: true, 
                    logging: false,
                    windowWidth: tempContainer.scrollWidth,
                    windowHeight: tempContainer.scrollHeight
                });
                
                // ⭐️⭐️⭐️ 변경된 부분 (JPEG -> PNG) ⭐️⭐️⭐️
                // ⭐️ jsPDF는 PNG 데이터 URL을 안정적으로 지원합니다.
                const imgData = canvas.toDataURL('image/png', 1.0);
                return imgData;
                // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️

            } catch (canvasError) {
                console.error("html2canvas error:", canvasError);
                throw new Error("리포트 섹션 이미지 변환 중 오류 발생");
            }
        }; 

        try {
            const pagesToRender = document.querySelectorAll('#printable-area .report-page');
            
            for (let i = 0; i < pagesToRender.length; i++) {
                const pageElement = pagesToRender[i];
                const imgData = await addElementToPdfPage(pageElement);
                
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.width / imgProps.height;
                
                let imgHeight = pdfWidth / ratio;
                let finalWidth = pdfWidth;
                let finalHeight = imgHeight;
                
                if (imgHeight > pdfHeight) {
                    finalHeight = pdfHeight;
                    finalWidth = pdfHeight * ratio;
                }
                
                if (i > 0) pdf.addPage();
                const xOffset = (pdfWidth - finalWidth) / 2;
                
                // ⭐️⭐️⭐️ 변경된 부분 (JPEG -> PNG) ⭐️⭐️⭐️
                // ⭐️ jsPDF에 이미지 형식이 'PNG'임을 명시합니다.
                pdf.addImage(imgData, 'PNG', xOffset, 0, finalWidth, finalHeight);
                // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
            }
            
            const fileName = reportType === 'individual' ? `${selectedClass}_${selectedDate}_${studentName}_리포트.pdf` : `${selectedClass}_${selectedDate}_반전체_리포트.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("PDF 생성 오류:", error);
            setErrorMessage(`PDF 생성 중 오류가 발생했습니다: ${error.message}.`);
        } finally {
            if(document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
            button.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> PDF로 저장`;
            button.disabled = false;
        }
    }, [activeChart, selectedClass, selectedDate, selectedStudent, setErrorMessage]);


    // --- 3. PDF 저장 Effect (useEffect) ---
    useEffect(() => {
        document.body.addEventListener('click', handlePdfSave);
        return () => document.body.removeEventListener('click', handlePdfSave);
    }, [handlePdfSave]);
};