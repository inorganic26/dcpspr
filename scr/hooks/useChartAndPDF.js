// scr/hooks/useChartAndPDF.js

import { useEffect, useCallback, useRef } from 'react';
import { useReportContext } from '../context/ReportContext';
import { renderScoreChart, renderCumulativeScoreChart } from '../lib/reportUtils.js';
import html2canvas from 'html2canvas'; 
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';

// ⭐️ 2. 폰트 데이터를 저장할 변수 (앱 실행 중 한 번만 로드)
let notoBase64 = null;

/**
 * public 폴더에서 폰트 파일을 비동기적으로 로드하고 Base64로 변환합니다.
 */
async function getFontBase64() {
    if (notoBase64) return notoBase64; // 이미 로드되었으면 캐시된 값 반환

    try {
        const response = await fetch('/NotoSansKR-Regular.ttf');
        if (!response.ok) throw new Error('NotoSansKR-Regular.ttf 폰트 파일을 /public 폴더에서 찾을 수 없습니다.');
        
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = (reader.result).split(',')[1];
                notoBase64 = base64Data; // 캐시 저장
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("폰트 로딩 실패:", error);
        throw new Error("PDF 생성에 필요한 한글 폰트(NotoSansKR-Regular.ttf)를 /public 폴더에서 불러오는 데 실패했습니다.");
    }
}

/**
 * jsPDF 인스턴스를 초기화하고 한글 폰트를 설정합니다.
 */
async function initializePdf() {
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    if (pdf.getFontList()['NotoSansKR'] === undefined) {
        const fontData = await getFontBase64(); 
        if (!fontData) throw new Error("PDF 폰트 데이터가 없습니다.");

        try {
            pdf.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
            pdf.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
        } catch (e) {
            console.error("Failed to add font to jsPDF:", e);
            throw new Error(`PDF 폰트 로딩 실패: ${e.message}.`);
        }
    }
    
    pdf.setFont('NotoSansKR', 'normal');
    
    return pdf;
}

/**
 * PDF에 리포트 타이틀을 추가합니다.
 */
function addPdfTitle(pdf, title, subtitle) {
    pdf.setFontSize(22);
    pdf.setFont('NotoSansKR', 'normal'); 
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, 105, 20, { align: 'center' });
    if (subtitle) {
        pdf.setFontSize(14);
        pdf.setTextColor(100);
        pdf.text(subtitle, 105, 30, { align: 'center' });
    }
}

/**
 * PDF에 섹션 제목을 추가합니다.
 */
function addPdfSectionTitle(pdf, title, yPos) {
    pdf.setFontSize(16);
    pdf.setFont('NotoSansKR', 'normal'); 
    pdf.setTextColor(29, 78, 216); // text-blue-700
    pdf.text(title, 15, yPos);
    
    const titleHeight = pdf.getTextDimensions(title).h;
    
    return yPos + titleHeight + 4; 
}

/**
 * 긴 텍스트를 자동 줄바꿈하여 PDF에 추가합니다.
 */
function addWrappedText(pdf, text, yPos, options = {}) {
    const { 
        x = 15, 
        maxWidth = 180, 
        fontSize = 10, 
        color = [40, 40, 40], 
        lineSpacing = 1.6 
    } = options;
    
    pdf.setFontSize(fontSize);
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.setFont('NotoSansKR', 'normal'); 
    
    const lines = pdf.splitTextToSize(text || ' ', maxWidth);
    pdf.text(lines, x, yPos, { lineHeightFactor: lineSpacing });
    
    const textHeight = (lines.length * fontSize * 0.352778 * lineSpacing);
    if (yPos + textHeight > 280) { 
        pdf.addPage();
        return 20; 
    }
    
    return yPos + textHeight + 2;
}

/**
 * ⭐️ [수정] 3개의 박스로 구성된 '주요 특징' 섹션을 그립니다. (여백 버그 수정)
 * @returns {number} 다음 컨텐츠가 시작될 Y축 위치
 */
function addFeaturesSection(pdf, data, yPos) {
    if (!data || !data.students) { 
        console.error("addFeaturesSection: Invalid data");
        return yPos;
    }
    
    const submittedStudents = data.students.filter(s => s.submitted);
    const scores = submittedStudents.map(s => s.score).filter(s => typeof s === 'number');
    const maxScore = scores.length > 0 ? Math.max.apply(null, scores) : 'N/A';
    const minScore = scores.length > 0 ? Math.min.apply(null, scores) : 'N/A';
    const classAverage = data.classAverage ?? 'N/A';
    
    const allCorrectQuestions = [];
    data.answerRates.forEach((rate, i) => {
        if (rate === 100) allCorrectQuestions.push(i + 1);
    });

    const highErrorRateQuestions = [];
    data.answerRates.forEach((rate, i) => {
        if (rate <= 40) highErrorRateQuestions.push({ qNum: i + 1, rate: rate });
    });

    // --- ⭐️ [수정] 높이 계산 로직 (여백 버그 수정) ---
    const boxWidth = 58;
    const boxMargin = 7.5;
    const startX = 15;
    const minBoxHeight = 25; // 최소 높이
    const maxBoxHeight = 55; // ⭐️ 최대 높이 55mm (5.5cm)로 설정
    
    // ⭐️ [신규] 'addAiAnalysisSection'과 동일한 패딩 값 사용
    const topPadding = 6;
    const textPadding = 2;
    const bottomPadding = 6;
    
    pdf.setFont('NotoSansKR', 'normal'); 
    
    // ⭐️ [신규] 타이틀 높이 계산 (11pt)
    pdf.setFontSize(11);
    const titleHeight = pdf.getTextDimensions('M').h; // 11pt 폰트의 대략적인 높이

    const calcTextHeight = (text, fontSize, lineSpacing, maxWidth) => {
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        return (lines.length * fontSize * 0.352778 * lineSpacing);
    };
    
    // 1. 점수 분포 (파란색) 높이 계산
    const scoreText = `최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${classAverage}점`;
    const scoreTextHeight = calcTextHeight(scoreText, 10, 1.6, boxWidth - 10);
    const scoreBoxHeight = topPadding + titleHeight + textPadding + scoreTextHeight + bottomPadding;

    // 2. 전원 정답 (녹색) 높이 계산
    const correctText = allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음';
    const correctTextHeight = calcTextHeight(correctText, 10, 1.6, boxWidth - 10);
    const correctBoxHeight = topPadding + titleHeight + textPadding + correctTextHeight + bottomPadding;

    // 3. 오답 문항 (붉은색) 높이 계산
    const errorText = highErrorRateQuestions.length > 0 
        ? highErrorRateQuestions.map(q => `${q.qNum}번 (${q.rate}%)`).join(', ') 
        : '없음';
    const errorTextHeight = calcTextHeight(errorText, 9, 1.6, boxWidth - 10);
    const errorBoxHeight = topPadding + titleHeight + textPadding + errorTextHeight + bottomPadding;

    // 4. 3개 높이 중 가장 큰 값을 선택하되, 최소/최대 높이 적용
    let boxHeight = Math.max(scoreBoxHeight, correctBoxHeight, errorBoxHeight);
    boxHeight = Math.max(minBoxHeight, Math.min(boxHeight, maxBoxHeight));
    // --- ⭐️ [수정] 높이 계산 로직 완료 ---

    pdf.setLineWidth(0.5);

    // ⭐️ [신규] 텍스트 시작 Y 좌표 계산
    const titleStartY = yPos + topPadding + (11 * 0.352778); // 11pt 폰트 높이 보정
    const textStartY = yPos + topPadding + titleHeight + textPadding + (10 * 0.352778); // 10pt 폰트 높이 보정
    const errorTextStartY = yPos + topPadding + titleHeight + textPadding + (9 * 0.352778); // 9pt 폰트 높이 보정


    // 1. 점수 분포 (파란색)
    pdf.setFillColor(239, 246, 255); // bg-indigo-50
    pdf.setDrawColor(224, 231, 255); // border-indigo-200
    pdf.rect(startX, yPos, boxWidth, boxHeight, 'FD'); // ⭐️ 수정된 boxHeight 적용
    pdf.setFontSize(11);
    pdf.setTextColor(49, 46, 129); // text-indigo-800
    pdf.text('📈 점수 분포', startX + 5, titleStartY); // ⭐️ yPos + 8 -> titleStartY
    pdf.setFontSize(10);
    pdf.setTextColor(67, 56, 202); // text-indigo-700
    addWrappedText(pdf, scoreText, textStartY, { x: startX + 5, maxWidth: boxWidth - 10, fontSize: 10, color: [67, 56, 202] }); // ⭐️ yPos + 16 -> textStartY

    // 2. 전원 정답 문항 (녹색)
    pdf.setFillColor(240, 253, 244); // bg-green-50
    pdf.setDrawColor(220, 252, 231); // border-green-200
    pdf.rect(startX + boxWidth + boxMargin, yPos, boxWidth, boxHeight, 'FD'); // ⭐️ 수정된 boxHeight 적용
    pdf.setFontSize(11);
    pdf.setTextColor(22, 101, 52); // text-green-800
    pdf.text('✅ 전원 정답 문항', startX + boxWidth + boxMargin + 5, titleStartY); // ⭐️ yPos + 8 -> titleStartY
    pdf.setFontSize(10);
    pdf.setTextColor(21, 128, 61); // text-green-700
    addWrappedText(pdf, correctText, textStartY, { x: startX + boxWidth + boxMargin + 5, maxWidth: boxWidth - 10, fontSize: 10, color: [21, 128, 61] }); // ⭐️ yPos + 16 -> textStartY

    // 3. 오답률 높은 문항 (붉은색)
    pdf.setFillColor(254, 242, 242); // bg-red-50
    pdf.setDrawColor(254, 226, 226); // border-red-200
    pdf.rect(startX + (boxWidth + boxMargin) * 2, yPos, boxWidth, boxHeight, 'FD'); // ⭐️ 수정된 boxHeight 적용
    pdf.setFontSize(11);
    pdf.setTextColor(153, 27, 27); // text-red-800
    pdf.text('❌ 오답률 높은 문항 (40% 이하)', startX + (boxWidth + boxMargin) * 2 + 5, titleStartY); // ⭐️ yPos + 8 -> titleStartY
    pdf.setFontSize(9);
    addWrappedText(pdf, errorText, errorTextStartY, { x: startX + (boxWidth + boxMargin) * 2 + 5, maxWidth: boxWidth - 10, fontSize: 9, color: [185, 28, 28] }); // ⭐️ yPos + 16 -> errorTextStartY

    return yPos + boxHeight + 10;
}


/**
 * AI 분석 (3가지 항목) 섹션을 그립니다.
 */
function addAiAnalysisSection(pdf, title, content, yPos, colorTheme = 'gray') {
    const colors = {
        gray: { bg: [243, 244, 246], border: [229, 231, 235], text: [55, 65, 81], title: [17, 24, 39] },
        blue: { bg: [239, 246, 255], border: [219, 234, 254], text: [30, 64, 175], title: [30, 58, 138] },
        red: { bg: [254, 242, 242], border: [254, 226, 226], text: [185, 28, 28], title: [153, 27, 27] },
        green: { bg: [240, 253, 244], border: [220, 252, 231], text: [21, 128, 61], title: [22, 101, 52] },
    };
    const theme = colors[colorTheme];

    let displayText = content;
    if (content === undefined) {
        displayText = 'AI 분석 대기 중...';
    } else if (content === null) {
        displayText = 'AI 분석 중 오류가 발생했습니다.';
    } else if (typeof content === 'string' && content.trim() === '') {
        displayText = '(내용 없음)';
    }

    if (typeof displayText === 'string') {
        displayText = displayText.replace(/<br\s*\/?>/gi, ' '); 
        displayText = displayText.replace(/\n/g, ' '); 
        displayText = displayText.replace(/\s+/g, ' ');
        displayText = displayText.trim(); 
    }

    pdf.setFont('NotoSansKR', 'normal');
    
    pdf.setFontSize(11);
    const titleHeight = pdf.getTextDimensions(title).h; 
    
    const textLines = pdf.splitTextToSize(displayText, 170); 
    pdf.setFontSize(10);
    const textHeight = (textLines.length * 10 * 0.352778 * 1.6);
    
    const topPadding = 6; 
    const textPadding = 2; 
    const bottomPadding = 6; 
    
    const calculatedTextHeight = textHeight > 0 && displayText.length > 0 ? textHeight : 0; 
    
    const boxHeight = topPadding + titleHeight + (calculatedTextHeight > 0 ? textPadding + calculatedTextHeight : 0) + bottomPadding;
    
    if (yPos + boxHeight > 280) { 
        pdf.addPage();
        yPos = 20; 
    }
    
    pdf.setDrawColor(theme.border[0], theme.border[1], theme.border[2]);
    pdf.setFillColor(theme.bg[0], theme.bg[1], theme.bg[2]);
    pdf.rect(15, yPos, 180, boxHeight, 'FD'); 
    
    pdf.setFontSize(11);
    pdf.setTextColor(theme.title[0], theme.title[1], theme.title[2]);
    pdf.text(title, 20, yPos + topPadding + (11 * 0.352778));
    
    const textStartY = yPos + topPadding + titleHeight + textPadding + (10 * 0.352778); 
    
    addWrappedText(pdf, displayText, textStartY, { 
        x: 20, 
        maxWidth: 170, 
        color: theme.text,
        fontSize: 10,
        lineSpacing: 1.6
    });

    return yPos + boxHeight + 5; 
}


/**
 * 난이도 계산 (임시)
 */
function getDifficulty(qNum, selectedClass) {
    if (!selectedClass) return '정보 없음';
    if (selectedClass.includes('고1')) {
        if (qNum >= 18) return '어려움';
        if (qNum >= 9) return '보통';
        return '쉬움';
    } else {
        if ([14, 15, 17, 18, 19, 21].includes(qNum)) return '어려움';
        if ([6, 7, 8, 9, 10, 11, 12, 13, 16, 20].includes(qNum)) return '보통';
        return '쉬움';
    }
}


// --- ⭐️ 메인 훅 (수정됨) ⭐️ ---
export const useChartAndPDF = () => {
    const { 
        currentPage, currentReportData, selectedClass, selectedDate, 
        selectedStudent, aiLoading, reportHTML, 
        activeChart, setActiveChart, setErrorMessage,
        reportCurrentPage
    } = useReportContext();

    const chartInstanceRef = useRef(null);

    // --- 1. 차트 렌더링 Effect (수정됨) ---
    useEffect(() => {
        const data = currentReportData;
        
        if (!data || !data.students || !reportHTML || aiLoading) {
            return;
        }

        const currentStudentObj = selectedStudent 
            ? data.students.find(s => s.name === selectedStudent) 
            : null;

        // --- 단일 시험 (막대) 차트 렌더링 ---
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        const canvas = document.getElementById('scoreChart');
        if (canvas) {
            
            const studentDataForChart = {
                students: data.students,
                classAverage: data.classAverage,
            };

            chartInstanceRef.current = renderScoreChart(
                canvas, 
                studentDataForChart, 
                currentStudentObj 
            );
            if (chartInstanceRef.current) {
                setActiveChart(chartInstanceRef.current);
            }
        }
        
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };

    }, [reportHTML, aiLoading, currentReportData, selectedClass, selectedDate, selectedStudent, setActiveChart, currentPage, reportCurrentPage]); 
    
    // --- 2. PDF 저장 핸들러 (수정됨) ---
    const handlePdfSave = useCallback(async () => {
        const button = document.getElementById('savePdfBtn');
        if (!button) return;
        
        button.textContent = '저장 중...';
        button.disabled = true;
        
        let currentActiveChart = chartInstanceRef.current;
        
        if (!currentActiveChart) {
             const chartCanvas = document.getElementById('scoreChart');
             const data = currentReportData; 
             if (chartCanvas && data?.students) { 
                 button.textContent = '차트 준비 중...'; 
                 console.warn('PDF 저장 전 차트 강제 렌더링 실행 (ref is null)');
                
                 const existingChart = Chart.getChart(chartCanvas);
                 if (existingChart) existingChart.destroy();
                
                 const studentForChart = data.students.find(s => s.name === selectedStudent) || null;
                 
                 const studentDataForChart = {
                     students: data.students,
                     classAverage: data.classAverage,
                 };

                 const newChart = renderScoreChart(
                    canvas, 
                    studentDataForChart, 
                    studentForChart
                 );
                
                 currentActiveChart = newChart; 
                 chartInstanceRef.current = newChart; 
                 setActiveChart(newChart); 
                
                 await new Promise(resolve => setTimeout(resolve, 300)); 
             }
        }
        
        button.textContent = '저장 중...';

        let pdf;
        try {
             pdf = await initializePdf();
        } catch (fontError) {
             console.error(fontError);
             setErrorMessage(fontError.message);
             button.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> PDF로 저장`;
             button.disabled = false;
             return;
        }

        const reportType = button.dataset.reportType;
        const studentName = button.dataset.studentName;

        try {
            const data = currentReportData; 
            if (!data) throw new Error('PDF 생성에 필요한 데이터를 찾을 수 없습니다.');
            
            const student = selectedStudent ? data.students?.find(s => s.name === selectedStudent) : null;
            const aiOverall = data.aiOverallAnalysis;
            const aiStudent = student?.aiAnalysis;
            
            const cleanText = (text) => text === undefined || text === null ? ' ' : String(text).replace(/\n/g, ' ');

            const unitMap = new Map();
            data.questionUnitMap?.question_units?.forEach(item => unitMap.set(item.qNum, item.unit));
            aiStudent?.incorrect_analysis?.forEach(item => { if (item.unit) unitMap.set(item.qNum, item.unit); });

            let chartImgData = null;
            const chartCanvas = document.getElementById('scoreChart');

            if (chartCanvas) {
                try {
                    if (currentActiveChart && typeof currentActiveChart.toBase64Image === 'function') {
                        chartImgData = currentActiveChart.toBase64Image('image/png', 1.0);
                    } else {
                        console.warn("currentActiveChart(ref)가 없거나 비정상입니다. html2canvas fallback 실행");
                        chartImgData = await html2canvas(chartCanvas, { 
                            scale: 2, logging: false, useCORS: true, backgroundColor: null 
                        }).then(canvas => canvas.toDataURL('image/png', 1.0));
                    }
                } catch (e) {
                    console.error('차트 캡처 실패 (scoreChart):', e);
                    chartImgData = null; 
                }
            }
            
            let yPos = 40; 

            if (reportType === 'individual') {
                if (!student) throw new Error('학생 데이터를 찾을 수 없습니다.');
                
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name}`);
                yPos = addPdfSectionTitle(pdf, '반 전체 주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos); // ⭐️ 수정된 함수 호출

                const commentText = document.getElementById('instructorComment')?.value ?? '';
                yPos = addPdfSectionTitle(pdf, '👨‍🏫 담당 강사 코멘트', yPos + 5);
                pdf.setDrawColor(107, 114, 128); 
                pdf.setFillColor(243, 244, 246); 
                const textLines = pdf.splitTextToSize(commentText || ' ', 170);
                const textHeight = (textLines.length * 10 * 0.352778 * 1.6) + 12;
                pdf.rect(15, yPos, 180, Math.max(30, textHeight), 'FD'); 
                addWrappedText(pdf, commentText || '(입력된 코멘트가 없습니다)', yPos + 6, { x: 20, maxWidth: 170, color: [55, 65, 81] });
                yPos += Math.max(30, textHeight) + 10;
                
                if (chartImgData) {
                    try {
                        yPos = addPdfSectionTitle(pdf, '📊 ' + selectedClass + ' 점수 분포표', yPos);
                        
                        const imgProps = pdf.getImageProperties(chartImgData);
                        const imgWidth = 180; 
                        let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                        imgHeight = Math.min(imgHeight, 100); 

                        const xOffset = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
                        
                        if (yPos + imgHeight > 280) { 
                             pdf.addPage();
                             yPos = 20;
                        }
                        
                        pdf.addImage(chartImgData, 'PNG', xOffset, yPos, imgWidth, imgHeight, undefined, 'FAST');
                        yPos += imgHeight + 10; 
                    } catch (e) {
                         console.error("PDF addImage 오류 (scoreChart Page 1):", e);
                         yPos = addWrappedText(pdf, '(단일 차트 로드 실패)', yPos, { color: [220, 38, 38] });
                    }
                } else {
                     yPos = addWrappedText(pdf, '(차트 이미지를 캡처하는 데 실패했습니다.)', yPos, { color: [220, 38, 38] });
                }

                pdf.addPage();
                pdf.setFont('NotoSansKR', 'normal'); 
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (AI 분석)`);
                yPos = addPdfSectionTitle(pdf, '🤖 AI 종합 분석', 40);
                
                if (yPos > 250) { 
                    pdf.addPage();
                    yPos = 20;
                }
                
                if (student.submitted) {
                    yPos = addAiAnalysisSection(pdf, '⭐ 강점 (Strengths)', aiStudent?.strengths, yPos, 'blue');
                    yPos = addAiAnalysisSection(pdf, '⚠️ 약점 (Weaknesses)', aiStudent?.weaknesses, yPos, 'red');
                    yPos = addAiAnalysisSection(pdf, '🚀 학습 추천 (Recommendations)', aiStudent?.recommendations, yPos, 'green');
                } else {
                    yPos = addAiAnalysisSection(pdf, '미응시', '학생이 시험에 응시하지 않아 AI 분석을 제공할 수 없습니다.', yPos, 'gray');
                }

                pdf.addPage();
                pdf.setFont('NotoSansKR', 'normal'); 
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (문항 정오표)`);
                yPos = addPdfSectionTitle(pdf, '📋 문항 정오표', 40);
                
                const errataBody = student.answers.map((ans, i) => ([
                    `${ans.qNum}번`,
                    unitMap.get(ans.qNum) || '',
                    getDifficulty(ans.qNum, selectedClass),
                    ans.isCorrect ? 'O' : 'X',
                    `${data.answerRates[i] ?? 'N/A'}%` 
                ]));
                
                autoTable(pdf, {
                    startY: yPos,
                    head: [['문항번호', '세부 개념 유형 (AI 분석)', '난이도', '정오', '반 전체 정답률(%)']],
                    body: errataBody,
                    theme: 'grid',
                    styles: { font: 'NotoSansKR', fontStyle: 'normal', fontSize: 8, cellPadding: 1.5 }, 
                    headStyles: { font: 'NotoSansKR', fontStyle: 'normal', fillColor: [248, 250, 252], textColor: [55, 65, 81], fontSize: 9 }, 
                    didDrawCell: (hookData) => {
                        if (hookData.section === 'body' && hookData.column.index === 3) {
                            if (hookData.cell.text[0] === 'X') {
                                hookData.cell.styles.textColor = [220, 38, 38]; 
                                hookData.cell.styles.fillColor = [254, 242, 242];
                            } else {
                                hookData.cell.styles.textColor = [37, 99, 235];
                            }
                        }
                    }
                });

                if (aiStudent?.incorrect_analysis?.length > 0) {
                    pdf.addPage();
                    pdf.setFont('NotoSansKR', 'normal'); 
                    addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (오답 분석)`);
                    yPos = addPdfSectionTitle(pdf, '🔍 오답 분석 및 대응 방안 (AI 기반)', 40);
                    
                    const analysisBody = aiStudent.incorrect_analysis.map(item => ([
                        `${item.qNum}번`,
                        unitMap.get(item.qNum) || '분석 필요',
                        getDifficulty(item.qNum, selectedClass),
                        cleanText(item.analysis_point),
                        cleanText(item.solution)
                    ]));

                    autoTable(pdf, {
                        startY: yPos,
                        head: [['문항번호', '세부 개념 유형', '난이도', '분석 포인트 (AI)', '대응 방안 (AI)']],
                        body: analysisBody,
                        theme: 'grid',
                        styles: { font: 'NotoSansKR', fontStyle: 'normal', fontSize: 8, cellPadding: 1.5 },
                        headStyles: { font: 'NotoSansKR', fontStyle: 'normal', fillColor: [248, 250, 252], textColor: [55, 65, 81], fontSize: 9 }, 
                        columnStyles: {
                            3: { cellWidth: 50 },
                            4: { cellWidth: 50 }
                        },
                        didDrawCell: (hookData) => {
                            if (hookData.section === 'body') {
                                hookData.cell.styles.fillColor = [254, 242, 242]; 
                            }
                        }
                    });
                }
                
            } else {
                // (반 전체 리포트 로직)
                addPdfTitle(pdf, `${selectedClass} ${selectedDate} 주간테스트 리포트 (반 전체)`);
                yPos = addPdfSectionTitle(pdf, '💡 반 전체 주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos); // ⭐️ 수정된 함수 호출
                yPos = addPdfSectionTitle(pdf, '🤖 반 전체 AI 종합 분석', yPos + 5);

                if (chartImgData) {
                    try {
                        const imgProps = pdf.getImageProperties(chartImgData);
                        const imgWidth = 180;
                        let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                        imgHeight = Math.min(imgHeight, 100);
                        const xOffset = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
                        
                        pdf.addImage(chartImgData, 'PNG', xOffset, yPos, imgWidth, imgHeight, undefined, 'FAST');
                        yPos += imgHeight + 10;
                    } catch (e) {
                        console.error("PDF addImage/getImageProperties 오류:", e);
                        yPos += 10;
                    }
                } else {
                    yPos = addWrappedText(pdf, '(차트 이미지를 캡처하는 데 실패했습니다. 다시 시도해 주세요.)', yPos, { color: [220, 38, 38] });
                    yPos += 5;
                }
                
                yPos = addAiAnalysisSection(pdf, '📊 종합 총평', aiOverall?.summary, yPos, 'gray');
                yPos = addAiAnalysisSection(pdf, '⚠️ 공통 약점 분석', aiOverall?.common_weaknesses, yPos, 'red');
                yPos = addAiAnalysisSection(pdf, '🚀 수업 지도 방안', aiOverall?.recommendations, yPos, 'green');

                if (aiOverall?.question_analysis?.length > 0) {
                    pdf.addPage();
                    pdf.setFont('NotoSansKR', 'normal'); 
                    addPdfTitle(pdf, `${selectedClass} ${selectedDate} 주간테스트 리포트 (반 전체)`);
                    yPos = addPdfSectionTitle(pdf, '🔍 주요 오답 문항 분석 (AI 기반)', 40);
                    
                    const analysisBody = aiOverall.question_analysis.map(item => ([
                        `${item.qNum}번`,
                        cleanText(item.unit),
                        cleanText(item.analysis_point),
                        cleanText(item.solution)
                    ]));

                    autoTable(pdf, {
                        startY: yPos,
                        head: [['문항번호', '세부 개념 유형 (AI)', '핵심 분석', '지도 방안']],
                        body: analysisBody,
                        theme: 'grid',
                        styles: { font: 'NotoSansKR', fontStyle: 'normal', fontSize: 8, cellPadding: 1.5 },
                        headStyles: { font: 'NotoSansKR', fontStyle: 'normal', fillColor: [248, 250, 252], textColor: [55, 65, 81], fontSize: 9 }, 
                        columnStyles: {
                            2: { cellWidth: 55 },
                            3: { cellWidth: 55 }
                        },
                        didDrawCell: (hookData) => {
                            if (hookData.section === 'body') {
                                hookData.cell.styles.fillColor = [254, 242, 242];
                            }
                        }
                    });
                }
            }
            
            // --- PDF 저장 ---
            const fileName = reportType === 'individual' ? `${selectedClass}_${selectedDate}_${studentName}_리포트.pdf` : `${selectedClass}_${selectedDate}_반전체_리포트.pdf`;
            pdf.save(fileName);

        } catch (error) {
            console.error("PDF 생성 오류:", error);
            setErrorMessage(`PDF 생성 중 오류가 발생했습니다: ${error.message}.`);
        } finally {
            button.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> PDF로 저장`;
            button.disabled = false;
        }
    }, [currentReportData, selectedClass, selectedDate, selectedStudent, setErrorMessage, reportCurrentPage, setActiveChart]); 

    
    return { handlePdfSave };
};