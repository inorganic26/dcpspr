// scr/hooks/useChartAndPDF.js

import { useEffect, useCallback, useRef } from 'react';
import { useReportContext } from '../context/ReportContext';
import { renderScoreChart, renderCumulativeScoreChart } from '../lib/reportUtils.js';
import html2canvas from 'html2canvas'; 
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';

// (이 파일의 1~310라인까지의 폰트 로드 및 PDF 헬퍼 함수들은 동일합니다)
// ... (getFontBase64, initializePdf, addPdfTitle, addPdfSectionTitle, addWrappedText, addFeaturesSection, addAiAnalysisSection, getDifficulty 함수는 동일) ...

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
 */
async function initializePdf() {
    // jsPDF 인스턴스 생성
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // ⭐️ 3. VFS(가상 파일 시스템)에 폰트 추가
    if (pdf.getFontList()['NotoSansKR'] === undefined) {
        const fontData = await getFontBase64(); // 폰트 동적 로드
        if (!fontData) throw new Error("PDF 폰트 데이터가 없습니다.");

        try {
            pdf.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
            // ⭐️ [폰트 오류 해결] 'Identity-H' 인코딩 파라미터를 제거합니다.
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
    pdf.setFont('NotoSansKR', 'normal'); // ⭐️ 한글 깨짐 방지 (호출 시 폰트 재설정)
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
    pdf.setFont('NotoSansKR', 'normal'); // ⭐️ 한글 깨짐 방지 (호출 시 폰트 재설정)
    pdf.setTextColor(29, 78, 216); // text-blue-700
    pdf.text(title, 15, yPos);
    
    const titleHeight = pdf.getTextDimensions(title).h;
    
    return yPos + titleHeight + 4; // 텍스트 높이 + 약간의 패딩
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
    pdf.setFont('NotoSansKR', 'normal'); // ⭐️ 한글 깨짐 방지 (호출 시 폰트 재설정)
    
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
    // ⭐️ [수정] 'data.studentData' -> 'data'
    if (!data || !data.students) { 
        console.error("addFeaturesSection: Invalid data");
        return yPos;
    }
    
    // ⭐️ [수정] 데이터 참조 변경
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

    const boxWidth = 58;
    const boxMargin = 7.5;
    const startX = 15;
    let boxHeight = 25; // ⭐️ [수정] 최소 높이값으로 사용됨 (minBoxHeight)

    const errorText = highErrorRateQuestions.length > 0 
        ? highErrorRateQuestions.map(q => `${q.qNum} (${q.rate}%)`).join(', ') 
        : '없음';
    
    pdf.setFont('NotoSansKR', 'normal'); // ⭐️ splitTextToSize 전에 폰트 설정
    const errorTextLines = pdf.splitTextToSize(errorText, boxWidth - 10);
    const errorTextHeight = (errorTextLines.length * 9 * 0.352778 * 1.6) + 18;
    
    boxHeight = Math.max(25, Math.min(errorTextHeight, 50)); 

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
 * [수정됨] AI 분석 (3가지 항목) 섹션을 그립니다.
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
        // ⭐️ [수정] 'testData' -> 'currentReportData'
        currentPage, currentReportData, selectedClass, selectedDate, 
        selectedStudent, aiLoading, reportHTML, 
        activeChart, setActiveChart, setErrorMessage,
        reportCurrentPage
    } = useReportContext();

    const chartInstanceRef = useRef(null);

    // --- 1. 차트 렌더링 Effect (수정됨) ---
    useEffect(() => {
        // ⭐️ [수정] 데이터 준비 (currentReportData)
        const data = currentReportData;
        
        // ⭐️ [수정] 데이터 유효성 검사 (data.students)
        if (!data || !data.students || !reportHTML || aiLoading) {
            return;
        }

        // 현재 학생 객체 찾기
        const currentStudentObj = selectedStudent 
            ? data.students.find(s => s.name === selectedStudent) 
            : null;

        // --- 단일 시험 (막대) 차트 렌더링 ---
        if (chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
        }
        const canvas = document.getElementById('scoreChart');
        if (canvas) {
            
            // ⭐️ [신규] renderScoreChart에 맞는 'studentData' 객체 생성
            const studentDataForChart = {
                students: data.students,
                classAverage: data.classAverage,
                // (renderScoreChart가 필요로 하는 다른 통계가 있다면 추가)
            };

            chartInstanceRef.current = renderScoreChart(
                canvas, 
                studentDataForChart, // ⭐️ 수정된 객체 전달
                currentStudentObj 
            );
            if (chartInstanceRef.current) {
                setActiveChart(chartInstanceRef.current);
            }
        }
        
        // Effect Cleanup 함수
        return () => {
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
            // ⭐️ 기존 349라인의 버그 (setActiveChart(null) 호출)는 이미 제거된 상태 유지
        };

    // ⭐️ [수정] 의존성 배열에 'currentReportData' 추가
    }, [reportHTML, aiLoading, currentReportData, selectedClass, selectedDate, selectedStudent, setActiveChart, currentPage, reportCurrentPage]); 
    // --- 차트 렌더링 Effect 수정 완료 ---

    
    // --- 2. PDF 저장 핸들러 (수정됨) ---
    const handlePdfSave = useCallback(async () => {
        const button = document.getElementById('savePdfBtn');
        if (!button) return;
        
        button.textContent = '저장 중...';
        button.disabled = true;
        
        let currentActiveChart = chartInstanceRef.current;
        
        // ⭐️ [수정] 차트 강제 렌더링 로직 (currentReportData)
        if (!currentActiveChart) {
             const chartCanvas = document.getElementById('scoreChart');
             // ⭐️ [수정] 'testData' -> 'currentReportData'
             const data = currentReportData; 
             if (chartCanvas && data?.students) { // ⭐️ 수정
                 button.textContent = '차트 준비 중...'; 
                 console.warn('PDF 저장 전 차트 강제 렌더링 실행 (ref is null)');
                
                 const existingChart = Chart.getChart(chartCanvas);
                 if (existingChart) existingChart.destroy();
                
                 // ⭐️ [수정] 데이터 참조 변경
                 const studentForChart = data.students.find(s => s.name === selectedStudent) || null;
                 
                 // ⭐️ [신규] renderScoreChart에 맞는 'studentData' 객체 생성
                 const studentDataForChart = {
                     students: data.students,
                     classAverage: data.classAverage,
                 };

                 const newChart = renderScoreChart(
                    chartCanvas, 
                    studentDataForChart, // ⭐️ 수정된 객체 전달
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
             // (버튼 복구 로직...)
             button.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> PDF로 저장`;
             button.disabled = false;
             return;
        }

        const reportType = button.dataset.reportType;
        const studentName = button.dataset.studentName;

        try {
            // --- 데이터 준비 (수정됨) ---
            // ⭐️ [수정] 'testData' -> 'currentReportData'
            const data = currentReportData; 
            if (!data) throw new Error('PDF 생성에 필요한 데이터를 찾을 수 없습니다.');
            
            // ⭐️ [수정] 데이터 참조 변경
            const student = selectedStudent ? data.students?.find(s => s.name === selectedStudent) : null;
            const aiOverall = data.aiOverallAnalysis;
            const aiStudent = student?.aiAnalysis;
            
            const cleanText = (text) => text === undefined || text === null ? ' ' : String(text).replace(/\n/g, ' ');

            const unitMap = new Map();
            data.questionUnitMap?.question_units?.forEach(item => unitMap.set(item.qNum, item.unit));
            aiStudent?.incorrect_analysis?.forEach(item => { if (item.unit) unitMap.set(item.qNum, item.unit); });

            // --- ⭐️ 차트 이미지 생성 ⭐️ ---
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
            
            let yPos = 40; // Y축 시작 위치

            // --- PDF 페이지 생성 시작 ---
            if (reportType === 'individual') {
                if (!student) throw new Error('학생 데이터를 찾을 수 없습니다.');
                
                // ⭐️ 페이지 1: 종합 분석 + 강사 코멘트
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name}`);
                yPos = addPdfSectionTitle(pdf, '반 전체 주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos); // ⭐️ 'data' 전달 (수정됨)

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
                        
                        // ⭐️ 'PNG' 형식 명시
                        pdf.addImage(chartImgData, 'PNG', xOffset, yPos, imgWidth, imgHeight, undefined, 'FAST');
                        yPos += imgHeight + 10; 
                    } catch (e) {
                         console.error("PDF addImage 오류 (scoreChart Page 1):", e);
                         yPos = addWrappedText(pdf, '(단일 차트 로드 실패)', yPos, { color: [220, 38, 38] });
                    }
                } else {
                     yPos = addWrappedText(pdf, '(차트 이미지를 캡처하는 데 실패했습니다.)', yPos, { color: [220, 38, 38] });
                }


                // ⭐️ 페이지 2: AI 종합 분석
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

                // ⭐️ 페이지 3: 문항 정오표 (AutoTable 사용)
                pdf.addPage();
                pdf.setFont('NotoSansKR', 'normal'); 
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (문항 정오표)`);
                yPos = addPdfSectionTitle(pdf, '📋 문항 정오표', 40);
                
                // ⭐️ [수정] 데이터 참조 변경 (data.answerRates)
                const errataBody = student.answers.map((ans, i) => ([
                    `${ans.qNum}번`,
                    unitMap.get(ans.qNum) || '',
                    getDifficulty(ans.qNum, selectedClass),
                    ans.isCorrect ? 'O' : 'X',
                    `${data.answerRates[i] ?? 'N/A'}%` // ⭐️
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

                // ⭐️ 페이지 4: 오답 분석 및 대응 방안 (AutoTable 사용)
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
                yPos = addFeaturesSection(pdf, data, yPos); // ⭐️ 'data' 전달 (수정됨)
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
            // (버튼 복구 로직)
            button.innerHTML = `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="16" width="16" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> PDF로 저장`;
            button.disabled = false;
        }
    // ⭐️ [수정] 의존성 배열 변경 ('currentReportData' 추가, 'activeChart' 제거)
    }, [currentReportData, selectedClass, selectedDate, selectedStudent, setErrorMessage, reportCurrentPage, setActiveChart]); 

    
    return { handlePdfSave };
};