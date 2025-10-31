import { useEffect, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { renderScoreChart } from '../lib/reportUtils.js';
import html2canvas from 'html2canvas'; // ⭐️ 강사 코멘트 등 다른 요소에 여전히 필요
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // 1. jspdf-autotable 임포트
import Chart from 'chart.js/auto';

// ⭐️ 2. 폰트 데이터를 저장할 변수 (앱 실행 중 한 번만 로드)
let notoBase64 = null;

/**
 * public 폴더에서 폰트 파일을 비동기적으로 로드하고 Base64로 변환합니다.
 */
async function getFontBase64() {
    if (notoBase64) return notoBase64; // 이미 로드되었으면 캐시된 값 반환

    try {
        // Vite는 public 폴더의 파일을 루트 경로로 제공합니다.
        const response = await fetch('/NotoSansKR-Regular.ttf');
        if (!response.ok) throw new Error('NotoSansKR-Regular.ttf 폰트 파일을 /public 폴더에서 찾을 수 없습니다.');
        
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            // ⭐️ ArrayBuffer를 Base64로 안전하게 변환
            reader.onloadend = () => {
                // btoa 오류를 피하기 위해 data URL에서 Base64 부분만 추출
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
 * (autoTable 로딩 오류 방어 로직 강화)
 */
async function initializePdf() {
    // jsPDF 인스턴스 생성
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // 💡 autoTable 로딩 오류 방어: autoTable 함수가 없으면 재로딩 시도
    if (typeof pdf.autoTable !== 'function') {
        try {
            // jspdf-autotable 플러그인을 동적으로 재임포트하여 로딩을 강제함
            // (대부분의 모듈 시스템에서 이 방식이 autoTable(jsPDF)를 대체합니다.)
            await import('jspdf-autotable'); 
        } catch (e) {
            console.warn("jspdf-autotable 재로딩 시도 실패:", e);
        }
    }
    
    // ⭐️ 3. VFS(가상 파일 시스템)에 폰트 추가
    if (pdf.getFontList()['NotoSansKR'] === undefined) {
        const fontData = await getFontBase64(); // 폰트 동적 로드
        if (!fontData) throw new Error("PDF 폰트 데이터가 없습니다.");

        try {
            pdf.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
            pdf.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
        } catch (e) {
            console.error("Failed to add font to jsPDF:", e);
            // 폰트 데이터가 손상되었거나 Base64 변환에 실패한 경우
            throw new Error(`PDF 폰트 로딩 실패: ${e.message}.`);
        }
    }
    
    pdf.setFont('NotoSansKR', 'normal');
    
    // 💡 중요: autoTable 로딩이 성공적으로 이루어졌는지 최종 확인
    if (typeof pdf.autoTable !== 'function') {
         throw new Error("PDF 플러그인 로딩 오류: pdf.autoTable이 정의되지 않았습니다. 패키지 설치 및 임포트 순서를 확인하세요.");
    }

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
 * @returns {number} 다음 컨텐츠가 시작될 Y축 위치
 */
function addPdfSectionTitle(pdf, title, yPos) {
    pdf.setFontSize(16);
    pdf.setFont('NotoSansKR', 'normal');
    pdf.setTextColor(29, 78, 216); // text-blue-700
    pdf.text(title, 15, yPos);
    
    const titleHeight = pdf.getTextDimensions(title).h;
    const padding = 2;
    pdf.setDrawColor(219, 234, 254); // bg-blue-100
    pdf.setLineWidth(1.5);
    pdf.line(15, yPos + titleHeight - padding, 195, yPos + titleHeight - padding);
    
    return yPos + titleHeight + 4;
}

/**
 * 긴 텍스트를 자동 줄바꿈하여 PDF에 추가합니다.
 * @returns {number} 다음 컨텐츠가 시작될 Y축 위치
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
    
    // A4 페이지(세로 297mm)를 넘어갈 경우 자동 페이지 추가
    const textHeight = (lines.length * fontSize * 0.352778 * lineSpacing);
    if (yPos + textHeight > 280) { // 여백 고려
        pdf.addPage();
        return 20; // 새 페이지 상단
    }
    
    return yPos + textHeight + 2;
}

/**
 * 3개의 박스로 구성된 '주요 특징' 섹션을 그립니다.
 * @returns {number} 다음 컨텐츠가 시작될 Y축 위치
 */
function addFeaturesSection(pdf, data, yPos) {
    if (!data || !data.studentData) {
        console.error("addFeaturesSection: Invalid data");
        return yPos;
    }
    
    const submittedStudents = data.studentData.students.filter(s => s.submitted);
    const scores = submittedStudents.map(s => s.score).filter(s => typeof s === 'number');
    const maxScore = scores.length > 0 ? Math.max.apply(null, scores) : 'N/A';
    const minScore = scores.length > 0 ? Math.min.apply(null, scores) : 'N/A';
    const classAverage = data.studentData.classAverage ?? 'N/A';
    
    const allCorrectQuestions = [];
    data.studentData.answerRates.forEach((rate, i) => {
        if (rate === 100) allCorrectQuestions.push(i + 1);
    });

    const highErrorRateQuestions = [];
    data.studentData.answerRates.forEach((rate, i) => {
        if (rate <= 40) highErrorRateQuestions.push({ qNum: i + 1, rate: rate });
    });

    // 박스 너비와 간격 설정
    const boxWidth = 58;
    const boxMargin = 7.5;
    const startX = 15;
    let boxHeight = 25; // 기본 높이

    const errorText = highErrorRateQuestions.length > 0 
        ? highErrorRateQuestions.map(q => `${q.qNum}번 (${q.rate}%)`).join(', ') 
        : '없음';
    
    // ⭐️ pdf.splitTextToSize는 pdf 객체가 초기화되어야 사용 가능
    const errorTextLines = pdf.splitTextToSize(errorText, boxWidth - 10);
    const errorTextHeight = (errorTextLines.length * 9 * 0.352778 * 1.6) + 18;
    boxHeight = Math.max(boxHeight, errorTextHeight); // 오답률 박스 높이에 맞춰 모든 박스 높이 통일

    pdf.setFont('NotoSansKR', 'normal');
    pdf.setLineWidth(0.5);

    // 1. 점수 분포
    pdf.setFillColor(239, 246, 255); // bg-indigo-50
    pdf.setDrawColor(224, 231, 255); // border-indigo-200
    pdf.rect(startX, yPos, boxWidth, boxHeight, 'FD');
    pdf.setFontSize(11);
    pdf.setTextColor(49, 46, 129); // text-indigo-800
    pdf.text('📈 점수 분포', startX + 5, yPos + 8);
    pdf.setFontSize(10);
    pdf.setTextColor(67, 56, 202); // text-indigo-700
    addWrappedText(pdf, `최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${classAverage}점`, yPos + 16, { x: startX + 5, maxWidth: boxWidth - 10, fontSize: 10, color: [67, 56, 202] });

    // 2. 전원 정답 문항
    pdf.setFillColor(240, 253, 244); // bg-green-50
    pdf.setDrawColor(220, 252, 231); // border-green-200
    pdf.rect(startX + boxWidth + boxMargin, yPos, boxWidth, boxHeight, 'FD');
    pdf.setFontSize(11);
    pdf.setTextColor(22, 101, 52); // text-green-800
    pdf.text('✅ 전원 정답 문항', startX + boxWidth + boxMargin + 5, yPos + 8);
    pdf.setFontSize(10);
    pdf.setTextColor(21, 128, 61); // text-green-700
    addWrappedText(pdf, allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음', yPos + 16, { x: startX + boxWidth + boxMargin + 5, maxWidth: boxWidth - 10, fontSize: 10, color: [21, 128, 61] });

    // 3. 오답률 높은 문항
    pdf.setFillColor(254, 242, 242); // bg-red-50
    pdf.setDrawColor(254, 226, 226); // border-red-200
    pdf.rect(startX + (boxWidth + boxMargin) * 2, yPos, boxWidth, boxHeight, 'FD');
    pdf.setFontSize(11);
    pdf.setTextColor(153, 27, 27); // text-red-800
    pdf.text('❌ 오답률 높은 문항 (40% 이하)', startX + (boxWidth + boxMargin) * 2 + 5, yPos + 8);
    pdf.setFontSize(9);
    addWrappedText(pdf, errorText, yPos + 16, { x: startX + (boxWidth + boxMargin) * 2 + 5, maxWidth: boxWidth - 10, fontSize: 9, color: [185, 28, 28] });

    return yPos + boxHeight + 10;
}


/**
 * AI 분석 (3가지 항목) 섹션을 그립니다.
 * @returns {number} 다음 컨텐츠가 시작될 Y축 위치
 */
function addAiAnalysisSection(pdf, title, content, yPos, colorTheme = 'gray') {
    const colors = {
        gray: { bg: [243, 244, 246], border: [229, 231, 235], text: [55, 65, 81], title: [17, 24, 39] },
        blue: { bg: [239, 246, 255], border: [219, 234, 254], text: [30, 64, 175], title: [30, 58, 138] },
        red: { bg: [254, 242, 242], border: [254, 226, 226], text: [185, 28, 28], title: [153, 27, 27] },
        green: { bg: [240, 253, 244], border: [220, 252, 231], text: [21, 128, 61], title: [22, 101, 52] },
    };
    const theme = colors[colorTheme];

    // 내용이 없으면 "AI 분석 중..." 또는 "실패" 메시지를 표시합니다.
    let displayText = content;
    if (content === undefined) {
        displayText = 'AI 분석 대기 중...';
    } else if (content === null) {
        displayText = 'AI 분석 중 오류가 발생했습니다.';
    } else if (typeof content === 'string' && content.trim() === '') {
        displayText = '(내용 없음)';
    }

    pdf.setFont('NotoSansKR', 'normal');
    
    // 텍스트 높이 계산
    const textLines = pdf.splitTextToSize(displayText, 170);
    const textHeight = (textLines.length * 10 * 0.352778 * 1.6) + 12; // 1.6 line height, 12mm padding(top/bottom)
    
    // 페이지 넘김 확인
    if (yPos + textHeight + 15 > 280) { // 280mm를 A4 한계로 설정 (여백 포함)
        pdf.addPage();
        yPos = 20; // 새 페이지 상단
    }
    
    pdf.setDrawColor(theme.border[0], theme.border[1], theme.border[2]);
    pdf.setFillColor(theme.bg[0], theme.bg[1], theme.bg[2]);
    pdf.rect(15, yPos, 180, textHeight + 15, 'FD');
    
    pdf.setFontSize(11);
    pdf.setTextColor(theme.title[0], theme.title[1], theme.title[2]);
    pdf.text(title, 20, yPos + 8);
    
    addWrappedText(pdf, displayText, yPos + 16, { x: 20, maxWidth: 170, color: theme.text });

    return yPos + textHeight + 15 + 5; // 다음 섹션 Y 위치
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
        // 예시 PDF의 난이도 기준 적용
        if ([14, 15, 17, 18, 19, 21].includes(qNum)) return '어려움';
        if ([6, 7, 8, 9, 10, 11, 12, 13, 16, 20].includes(qNum)) return '보통';
        return '쉬움';
    }
}


// --- ⭐️ 메인 훅 ⭐️ ---
export const useChartAndPDF = () => {
    const { 
        currentPage, testData, selectedClass, selectedDate, 
        selectedStudent, aiLoading, reportHTML, 
        activeChart, setActiveChart, setErrorMessage
    } = useReportContext();

    // --- 1. 차트 렌더링 Effect ---
    useEffect(() => {
        let newChart = null;
        
        if (currentPage === 'page5' && !aiLoading && reportHTML) {
            const chartCanvas = document.getElementById('scoreChart');
            const data = testData[selectedClass]?.[selectedDate];
            
            if (chartCanvas && data?.studentData) {
                const existingChart = Chart.getChart(chartCanvas);
                if (existingChart) existingChart.destroy();

                const ctx = chartCanvas.getContext('2d');
                if (ctx) ctx.willReadFrequently = true; 
                
                const studentForChart = data.studentData.students.find(s => s.name === selectedStudent) || null;
                newChart = renderScoreChart(chartCanvas, data.studentData, studentForChart);
                setActiveChart(newChart);
            }
        }
        
        return () => {
            if (newChart) {
                newChart.destroy();
                setActiveChart(null);
            }
        };
    }, [currentPage, aiLoading, reportHTML, selectedStudent, selectedClass, selectedDate, testData, setActiveChart]); 

    
    // --- 2. ⭐️ PDF 저장 핸들러 (텍스트 기반으로 전면 수정) ⭐️ ---
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
        
        button.textContent = '저장 중...';
        button.disabled = true;

        let pdf;
        try {
             // ⭐️ 한글 폰트가 설정된 PDF 객체 생성 (비동기)
             pdf = await initializePdf();
        } catch (fontError) {
             console.error(fontError);
             setErrorMessage(fontError.message);
             // 버튼 원래대로 복구
             button.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> PDF로 저장`;
             button.disabled = false;
             return;
        }

        const reportType = button.dataset.reportType;
        const studentName = button.dataset.studentName;

        try {
            // --- 데이터 준비 ---
            const data = testData[selectedClass]?.[selectedDate];
            if (!data) throw new Error('PDF 생성에 필요한 데이터를 찾을 수 없습니다.');
            
            const student = selectedStudent ? data.studentData?.students?.find(s => s.name === selectedStudent) : null;
            const aiOverall = data.aiOverallAnalysis;
            const aiStudent = student?.aiAnalysis;
            
            // 텍스트 줄바꿈 헬퍼
            const cleanText = (text) => text === undefined || text === null ? ' ' : String(text).replace(/\n/g, ' '); // 테이블 내 줄바꿈 방지

            // 유닛 맵 생성
            const unitMap = new Map();
            data.questionUnitMap?.question_units?.forEach(item => unitMap.set(item.qNum, item.unit));
            // 학생 AI 분석이 더 구체적인 유닛 정보를 가지고 있을 수 있으므로 덮어쓰기
            aiStudent?.incorrect_analysis?.forEach(item => { if (item.unit) unitMap.set(item.qNum, item.unit); });

            // --- ⭐️ 차트 이미지 생성 및 오류 방지 로직 (Data URL & 렌더링 지연) ⭐️ ---
            let chartImgData = null;
            const chartCanvas = document.getElementById('scoreChart');
            
            // 💡 렌더링 타이밍 문제 해결을 위해 500ms 대기
            await new Promise(r => setTimeout(r, 500)); 

            if (activeChart) {
                try {
                    // 1. Chart.js의 내장 함수 시도
                    chartImgData = activeChart.toBase64Image('image/png', 1.0);
                } catch (e) {
                    console.warn("Chart.js toBase64Image 실패, canvas toDataURL fallback 시도:", e);
                    // 2. Tainted Canvas 또는 기타 오류 시 일반 Canvas 메서드 시도
                    if (chartCanvas) {
                        chartImgData = chartCanvas.toDataURL('image/png', 1.0);
                    }
                }
                
                // 👇 Data URL 접두사가 없는 경우 추가 (UNKNOWN 오류 방지)
                if (chartImgData && !chartImgData.startsWith('data:')) {
                    chartImgData = `data:image/png;base64,${chartImgData}`;
                }
                // 👆 추가된 로직
            }
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            let yPos = 40; // Y축 시작 위치

            // --- PDF 페이지 생성 시작 ---
            if (reportType === 'individual') {
                if (!student) throw new Error('학생 데이터를 찾을 수 없습니다.');
                
                // ⭐️ 페이지 1: 종합 분석 + 강사 코멘트
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name}`);
                yPos = addPdfSectionTitle(pdf, '반 전체 주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos);

                const commentText = document.getElementById('instructorComment')?.value ?? '';
                yPos = addPdfSectionTitle(pdf, '👨‍🏫 담당 강사 코멘트', yPos + 5);
                pdf.setDrawColor(107, 114, 128); // border-gray-500
                pdf.setFillColor(243, 244, 246); // bg-gray-100
                const textLines = pdf.splitTextToSize(commentText || ' ', 170);
                const textHeight = (textLines.length * 10 * 0.352778 * 1.6) + 12;
                pdf.rect(15, yPos, 180, Math.max(30, textHeight), 'FD'); // 최소 높이 30mm
                addWrappedText(pdf, commentText || '(입력된 코멘트가 없습니다)', yPos + 6, { x: 20, maxWidth: 170, color: [55, 65, 81] });
                yPos += Math.max(30, textHeight) + 10;

                // ⭐️ 페이지 2: AI 종합 분석 + 차트
                pdf.addPage();
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (AI 분석)`);
                yPos = addPdfSectionTitle(pdf, '🤖 AI 종합 분석', 40);
                
                if (chartImgData) {
                    let imageFormat = '';
                    if (chartImgData.startsWith('data:image/png')) {
                        imageFormat = 'PNG';
                    } else if (chartImgData.startsWith('data:image/jpeg') || chartImgData.startsWith('data:image/jpg')) {
                        imageFormat = 'JPEG';
                    }

                    if (imageFormat) {
                        try {
                            const imgProps = pdf.getImageProperties(chartImgData);
                            const imgWidth = 180; // A4 너비에 맞춤 (좌우 여백 15mm*2)
                            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                            // ⭐️ 포맷을 명시하고 Data URL을 전달
                            pdf.addImage(chartImgData, imageFormat, 15, yPos, imgWidth, imgHeight, undefined, 'FAST');
                            yPos += imgHeight + 10;
                        } catch (e) {
                            console.error("PDF addImage/getImageProperties 오류:", e);
                            setErrorMessage(`PDF 차트 이미지 처리 중 오류가 발생했습니다: ${e.message}.`);
                            yPos += 70; // 오류 시 차트 공간 확보
                        }
                    } else {
                        console.error("차트 이미지 데이터 형식이 유효하지 않아 PDF에 추가할 수 없습니다.");
                        yPos += 70;
                    }
                }
                
                if (student.submitted) {
                    yPos = addAiAnalysisSection(pdf, '⭐ 강점 (Strengths)', aiStudent?.strengths, yPos, 'blue');
                    yPos = addAiAnalysisSection(pdf, '⚠️ 약점 (Weaknesses)', aiStudent?.weaknesses, yPos, 'red');
                    yPos = addAiAnalysisSection(pdf, '🚀 학습 추천 (Recommendations)', aiStudent?.recommendations, yPos, 'green');
                } else {
                    yPos = addAiAnalysisSection(pdf, '미응시', '학생이 시험에 응시하지 않아 AI 분석을 제공할 수 없습니다.', yPos, 'gray');
                }


                // ⭐️ 페이지 3: 문항 정오표 (AutoTable 사용)
                pdf.addPage();
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (문항 정오표)`);
                yPos = addPdfSectionTitle(pdf, '📋 문항 정오표', 40);
                
                const errataBody = student.answers.map((ans, i) => ([
                    `${ans.qNum}번`,
                    unitMap.get(ans.qNum) || '',
                    getDifficulty(ans.qNum, selectedClass),
                    ans.isCorrect ? 'O' : 'X',
                    `${data.studentData?.answerRates?.[i] ?? 'N/A'}%`
                ]));
                
                pdf.autoTable({
                    startY: yPos,
                    head: [['문항번호', '세부 개념 유형 (AI 분석)', '난이도', '정오', '반 전체 정답률(%)']],
                    body: errataBody,
                    theme: 'grid',
                    styles: { font: 'NotoSansKR', fontSize: 9 },
                    headStyles: { font: 'NotoSansKR', fillColor: [248, 250, 252], textColor: [55, 65, 81] },
                    didDrawCell: (hookData) => {
                        if (hookData.section === 'body' && hookData.column.index === 3) {
                            if (hookData.cell.text[0] === 'X') {
                                hookData.cell.styles.textColor = [220, 38, 38]; // text-red-600
                                hookData.cell.styles.fillColor = [254, 242, 242]; // bg-red-50
                            } else {
                                hookData.cell.styles.textColor = [37, 99, 235]; // text-blue-600
                            }
                        }
                    }
                });

                // ⭐️ 페이지 4: 오답 분석 및 대응 방안 (AutoTable 사용)
                if (aiStudent?.incorrect_analysis?.length > 0) {
                    pdf.addPage();
                    addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (오답 분석)`);
                    yPos = addPdfSectionTitle(pdf, '🔍 오답 분석 및 대응 방안 (AI 기반)', 40);
                    
                    const analysisBody = aiStudent.incorrect_analysis.map(item => ([
                        `${item.qNum}번`,
                        unitMap.get(item.qNum) || '분석 필요',
                        getDifficulty(item.qNum, selectedClass),
                        cleanText(item.analysis_point),
                        cleanText(item.solution)
                    ]));

                    pdf.autoTable({
                        startY: yPos,
                        head: [['문항번호', '세부 개념 유형', '난이도', '분석 포인트 (AI)', '대응 방안 (AI)']],
                        body: analysisBody,
                        theme: 'grid',
                        styles: { font: 'NotoSansKR', fontSize: 9, cellPadding: 2 },
                        headStyles: { font: 'NotoSansKR', fillColor: [248, 250, 252], textColor: [55, 65, 81] },
                        columnStyles: {
                            3: { cellWidth: 50 },
                            4: { cellWidth: 50 }
                        },
                        didDrawCell: (hookData) => {
                            if (hookData.section === 'body') {
                                hookData.cell.styles.fillColor = [254, 242, 242]; // bg-red-50
                            }
                        }
                    });
                }
                
            } else {
                // ⭐️ 페이지 1: 반 전체 종합 분석 + 차트
                addPdfTitle(pdf, `${selectedClass} ${selectedDate} 주간테스트 리포트 (반 전체)`);
                yPos = addPdfSectionTitle(pdf, '💡 반 전체 주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos);
                
                yPos = addPdfSectionTitle(pdf, '🤖 반 전체 AI 종합 분석', yPos + 5);

                if (chartImgData) {
                    let imageFormat = '';
                    if (chartImgData.startsWith('data:image/png')) {
                        imageFormat = 'PNG';
                    } else if (chartImgData.startsWith('data:image/jpeg') || chartImgData.startsWith('data:image/jpg')) {
                        imageFormat = 'JPEG';
                    }

                    if (imageFormat) {
                        try {
                            const imgProps = pdf.getImageProperties(chartImgData);
                            const imgWidth = 180;
                            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                            pdf.addImage(chartImgData, imageFormat, 15, yPos, imgWidth, imgHeight, undefined, 'FAST');
                            yPos += imgHeight + 10;
                        } catch (e) {
                            console.error("PDF addImage/getImageProperties 오류:", e);
                            setErrorMessage(`PDF 차트 이미지 처리 중 오류가 발생했습니다: ${e.message}.`);
                            yPos += 70;
                        }
                    } else {
                        console.error("차트 이미지 데이터 형식이 유효하지 않아 PDF에 추가할 수 없습니다.");
                        yPos += 70;
                    }
                }
                
                yPos = addAiAnalysisSection(pdf, '📊 종합 총평', aiOverall?.summary, yPos, 'gray');
                yPos = addAiAnalysisSection(pdf, '⚠️ 공통 약점 분석', aiOverall?.common_weaknesses, yPos, 'red');
                yPos = addAiAnalysisSection(pdf, '🚀 수업 지도 방안', aiOverall?.recommendations, yPos, 'green');


                // ⭐️ 페이지 2: 주요 오답 문항 분석 (표)
                if (aiOverall?.question_analysis?.length > 0) {
                    pdf.addPage();
                    addPdfTitle(pdf, `${selectedClass} ${selectedDate} 주간테스트 리포트 (반 전체)`);
                    yPos = addPdfSectionTitle(pdf, '🔍 주요 오답 문항 분석 (AI 기반)', 40);
                    
                    const analysisBody = aiOverall.question_analysis.map(item => ([
                        `${item.qNum}번`,
                        cleanText(item.unit),
                        cleanText(item.analysis_point),
                        cleanText(item.solution)
                    ]));

                    pdf.autoTable({
                        startY: yPos,
                        head: [['문항번호', '세부 개념 유형 (AI)', '핵심 분석', '지도 방안']],
                        body: analysisBody,
                        theme: 'grid',
                        styles: { font: 'NotoSansKR', fontSize: 9, cellPadding: 2 },
                        headStyles: { font: 'NotoSansKR', fillColor: [248, 250, 252], textColor: [55, 65, 81] },
                        columnStyles: {
                            2: { cellWidth: 55 },
                            3: { cellWidth: 55 }
                        },
                        didDrawCell: (hookData) => {
                            if (hookData.section === 'body') {
                                hookData.cell.styles.fillColor = [254, 242, 242]; // bg-red-50
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
    }, [activeChart, selectedClass, selectedDate, selectedStudent, setErrorMessage, testData]); // ⭐️ testData 의존성 추가


    // --- 3. PDF 저장 Effect (useEffect) ---
    useEffect(() => {
        document.body.addEventListener('click', handlePdfSave);
        return () => document.body.removeEventListener('click', handlePdfSave);
    }, [handlePdfSave]);
};