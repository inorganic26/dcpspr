// scr/hooks/useChartAndPDF.js

import { useEffect, useCallback, useRef } from 'react';
import { useReportContext } from '../context/ReportContext';
import { renderScoreChart } from '../lib/reportUtils.js';
import html2canvas from 'html2canvas'; 
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';
import katex from 'katex'; 

// 폰트 데이터 캐싱
let notoBase64 = null;

/**
 * ⭐️ [핵심 수정] 텍스트+수식 문단을 "고해상도 투명 이미지"로 변환
 * - 화면 밖(-9999px)이 아니라 화면 뒤(z-index: -9999)에 그려서 렌더링 누락 방지
 */
const convertTextToHighResImage = async (latexString, options = {}) => {
    if (!latexString) return null;
    const { width = 130, fontSize = 10, color = '#000000' } = options;

    // 1. 임시 div 생성
    const div = document.createElement('div');
    // ⭐️ 수정: 화면 밖으로 보내지 않고, 화면 내에 두되 뒤로 숨김 (캡처 성공률 100% 보장)
    div.style.position = 'fixed';
    div.style.left = '0px';
    div.style.top = '0px';
    div.style.zIndex = '-9999'; // 맨 뒤로 숨김
    
    // PDF 박스 너비(mm)를 픽셀로 대략 변환 (1mm ≈ 3.78px)
    div.style.width = `${width * 3.8}px`; 
    div.style.padding = '0';
    div.style.margin = '0';
    div.style.backgroundColor = 'transparent'; // 투명 배경
    
    // PDF와 동일한 폰트 스타일
    div.style.fontFamily = '"NotoSansKR", "Malgun Gothic", sans-serif';
    div.style.fontSize = `${fontSize * 1.33}px`; // pt -> px 보정
    div.style.lineHeight = '1.6';
    div.style.color = color;
    div.style.wordBreak = 'keep-all';
    // 텍스트 렌더링 품질 향상
    div.style.textRendering = 'optimizeLegibility';
    div.style.webkitFontSmoothing = 'antialiased';

    // 2. KaTeX 렌더링
    try {
        let htmlContent = latexString.replace(/\n/g, '<br>');

        // (1) 블록 수식
        htmlContent = htmlContent.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
            try { return katex.renderToString(math, { displayMode: true, throwOnError: false }); } 
            catch (e) { return math; }
        });

        // (2) 인라인 수식
        htmlContent = htmlContent.replace(/\$([^$]+)\$/g, (_, math) => {
            try { return katex.renderToString(math, { displayMode: false, throwOnError: false }); } 
            catch (e) { return math; }
        });

        div.innerHTML = htmlContent;

    } catch (e) {
        console.error("Text Parsing Error:", e);
        div.innerText = latexString; 
    }

    document.body.appendChild(div);

    // 3. html2canvas 캡처
    try {
        // 폰트 로딩 잠시 대기 (안정성 확보)
        await document.fonts.ready; 

        const canvas = await html2canvas(div, {
            scale: 3, // 3배 확대 (적절한 타협점)
            backgroundColor: null, // 투명 배경
            logging: false,
            useCORS: true,
            scrollX: 0,
            scrollY: 0,
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // PDF에 넣을 실제 높이 계산
        const pdfHeight = (canvas.height / 3) / 3.78 * 1.05; // 미세 보정

        return { imgData, width, height: pdfHeight };

    } catch (error) {
        console.error("html2canvas Error:", error);
        return null;
    } finally {
        if (document.body.contains(div)) {
            document.body.removeChild(div);
        }
    }
};


async function getFontBase64() {
    if (notoBase64) return notoBase64; 
    try {
        const response = await fetch('/NotoSansKR-Regular.ttf');
        if (!response.ok) throw new Error('NotoSansKR-Regular.ttf 폰트 파일을 /public 폴더에서 찾을 수 없습니다.');
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Data = (reader.result).split(',')[1];
                notoBase64 = base64Data; 
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("폰트 로딩 실패:", error);
        throw new Error("PDF 폰트 로딩 실패.");
    }
}

async function initializePdf() {
    const pdf = new jsPDF('p', 'mm', 'a4');
    if (pdf.getFontList()['NotoSansKR'] === undefined) {
        const fontData = await getFontBase64(); 
        if (!fontData) throw new Error("PDF 폰트 데이터 없음");
        try {
            pdf.addFileToVFS('NotoSansKR-Regular.ttf', fontData);
            pdf.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');
            pdf.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'bold'); 
        } catch (e) {
            console.error("Failed to add font:", e);
            throw e;
        }
    }
    pdf.setFont('NotoSansKR', 'normal');
    return pdf;
}

// 비상용 텍스트 정제 함수 (이미지 변환 실패 시 사용)
function cleanText(text) {
    if (text === undefined || text === null) return ' ';
    let str = String(text).replace(/\n/g, ' ');
    // $ 기호 제거
    str = str.replace(/\$\$/g, '').replace(/\$/g, ''); 
    // 백슬래시 제거
    str = str.replace(/\\/g, ''); 
    return str.trim();
}

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

function addPdfSectionTitle(pdf, title, yPos) {
    pdf.setFontSize(16);
    pdf.setFont('NotoSansKR', 'bold'); 
    pdf.setTextColor(29, 78, 216); 
    pdf.text(title, 15, yPos);
    return yPos + pdf.getTextDimensions(title).h + 4; 
}

// 일반 텍스트 출력
function addWrappedText(pdf, text, yPos, options = {}) {
    const { x = 15, maxWidth = 180, fontSize = 10, color = [40, 40, 40], lineSpacing = 1.6 } = options;
    
    // ⭐️ 혹시 모를 상황 대비 cleanText 적용
    const cleanContent = cleanText(text);

    pdf.setFontSize(fontSize);
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.setFont('NotoSansKR', 'normal'); 
    
    const lines = pdf.splitTextToSize(cleanContent || ' ', maxWidth);
    pdf.text(lines, x, yPos, { lineHeightFactor: lineSpacing });
    
    const textHeight = (lines.length * fontSize * 0.352778 * lineSpacing);
    if (yPos + textHeight > 280) { 
        pdf.addPage();
        return 20; 
    }
    return yPos + textHeight + 2;
}

function addFeaturesSection(pdf, data, yPos) {
    if (!data || !data.students) return yPos;
    
    const submittedStudents = data.students.filter(s => s.submitted);
    const scores = submittedStudents.map(s => s.score).filter(s => typeof s === 'number');
    const maxScore = scores.length > 0 ? Math.max.apply(null, scores) : 'N/A';
    const minScore = scores.length > 0 ? Math.min.apply(null, scores) : 'N/A';
    const classAverage = data.classAverage ?? 'N/A';
    
    const allCorrectQuestions = [];
    data.answerRates.forEach((rate, i) => { if (rate === 100) allCorrectQuestions.push(i + 1); });

    const highErrorRateQuestions = [];
    data.answerRates.forEach((rate, i) => { if (rate <= 40) highErrorRateQuestions.push({ qNum: i + 1, rate: rate }); });

    const boxWidth = 58;
    const boxMargin = 7.5;
    const startX = 15;
    const scoreText = `최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${classAverage}점`;
    const correctText = allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음';
    const errorText = highErrorRateQuestions.length > 0 ? highErrorRateQuestions.map(q => `${q.qNum}번 (${q.rate}%)`).join(', ') : '없음';

    const boxHeight = 50; 
    const titleStartY = yPos + 10;
    const textStartY = yPos + 20;

    // 1. 점수 분포
    pdf.setFillColor(239, 246, 255); pdf.setDrawColor(224, 231, 255);
    pdf.rect(startX, yPos, boxWidth, boxHeight, 'FD');
    pdf.setFontSize(11); pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(49, 46, 129);
    pdf.text('📈 점수 분포', startX + 5, titleStartY);
    addWrappedText(pdf, scoreText, textStartY, { x: startX + 5, maxWidth: boxWidth - 10, fontSize: 10, color: [67, 56, 202] });

    // 2. 전원 정답
    pdf.setFillColor(240, 253, 244); pdf.setDrawColor(220, 252, 231);
    pdf.rect(startX + boxWidth + boxMargin, yPos, boxWidth, boxHeight, 'FD');
    pdf.setFontSize(11); pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(22, 101, 52);
    pdf.text('✅ 전원 정답 문항', startX + boxWidth + boxMargin + 5, titleStartY);
    addWrappedText(pdf, correctText, textStartY, { x: startX + boxWidth + boxMargin + 5, maxWidth: boxWidth - 10, fontSize: 10, color: [21, 128, 61] });

    // 3. 오답률 높은 문항
    pdf.setFillColor(254, 242, 242); pdf.setDrawColor(254, 226, 226);
    pdf.rect(startX + (boxWidth + boxMargin) * 2, yPos, boxWidth, boxHeight, 'FD');
    pdf.setFontSize(11); pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(153, 27, 27);
    pdf.text('❌ 오답률 높은 문항', startX + (boxWidth + boxMargin) * 2 + 5, titleStartY);
    addWrappedText(pdf, errorText, textStartY, { x: startX + (boxWidth + boxMargin) * 2 + 5, maxWidth: boxWidth - 10, fontSize: 9, color: [185, 28, 28] });

    return yPos + boxHeight + 10;
}

function addAiAnalysisSection(pdf, title, content, yPos, colorTheme = 'gray') {
    const colors = {
        gray: { bg: [243, 244, 246], border: [229, 231, 235], text: [55, 65, 81], title: [17, 24, 39] },
        blue: { bg: [239, 246, 255], border: [219, 234, 254], text: [30, 64, 175], title: [30, 58, 138] },
        red: { bg: [254, 242, 242], border: [254, 226, 226], text: [185, 28, 28], title: [153, 27, 27] },
        green: { bg: [240, 253, 244], border: [220, 252, 231], text: [21, 128, 61], title: [22, 101, 52] },
    };
    const theme = colors[colorTheme];
    let displayText = cleanText(content || '내용 없음'); 

    pdf.setFontSize(10);
    pdf.setFont('NotoSansKR', 'normal');
    const lines = pdf.splitTextToSize(displayText, 170);
    const boxHeight = (lines.length * 5) + 25; 

    if (yPos + boxHeight > 280) { pdf.addPage(); yPos = 20; }

    pdf.setDrawColor(...theme.border); pdf.setFillColor(...theme.bg);
    pdf.rect(15, yPos, 180, boxHeight, 'FD');
    
    pdf.setFontSize(11); pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(...theme.title);
    pdf.text(title, 20, yPos + 10);
    
    addWrappedText(pdf, displayText, yPos + 18, { x: 20, maxWidth: 170, color: theme.text });
    
    return yPos + boxHeight + 5; 
}

export const useChartAndPDF = () => {
    const { 
        currentReportData, selectedClass, selectedDate, selectedStudent, 
        aiLoading, reportHTML, setActiveChart, setErrorMessage
    } = useReportContext();

    const chartInstanceRef = useRef(null);

    useEffect(() => {
        const data = currentReportData;
        if (!data || !data.students || !reportHTML || aiLoading) return;
        const currentStudentObj = selectedStudent ? data.students.find(s => s.name === selectedStudent) : null;
        const canvas = document.getElementById('scoreChart');
        if (chartInstanceRef.current) chartInstanceRef.current.destroy();
        if (canvas) {
            chartInstanceRef.current = renderScoreChart(canvas, { students: data.students, classAverage: data.classAverage }, currentStudentObj, true);
            if (chartInstanceRef.current) setActiveChart(chartInstanceRef.current);
        }
        return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
    }, [reportHTML, aiLoading, currentReportData, selectedClass, selectedDate, selectedStudent, setActiveChart]); 

    const handlePdfSave = useCallback(async () => {
        const button = document.getElementById('savePdfBtn');
        if (!button) return;
        
        button.textContent = '저장 중...';
        button.disabled = true;
        
        let chartImgData = null; 
        const chartCanvas = document.getElementById('scoreChart');
        const data = currentReportData; 
        
        if (chartCanvas && data?.students) { 
            button.textContent = '차트 준비 중...'; 
            const existingChart = Chart.getChart(chartCanvas);
            if (existingChart) existingChart.destroy();
            const newChart = renderScoreChart(chartCanvas, { students: data.students, classAverage: data.classAverage }, data.students.find(s => s.name === selectedStudent), false);
            if (newChart) {
                try { chartImgData = newChart.toBase64Image('image/png', 1.0); } catch(e) { console.error(e); }
                newChart.destroy();
            }
            if (!chartImgData) {
                 try { chartImgData = await html2canvas(chartCanvas, { scale: 2 }).then(c => c.toDataURL('image/png')); } catch (e) {}
            }
        }
        
        button.textContent = 'PDF 생성 중...';

        try {
            const pdf = await initializePdf();
            if (!data) throw new Error('데이터 없음');
            
            const reportType = button.dataset.reportType;
            const studentName = button.dataset.studentName;
            const student = selectedStudent ? data.students?.find(s => s.name === selectedStudent) : null;
            const aiStudent = student?.aiAnalysis;    
            const masterAnalysisMap = new Map();
            data.questionUnitMap?.question_analysis?.forEach(item => masterAnalysisMap.set(item.qNum, item));
            
            let yPos = 40; 

            if (reportType === 'individual') {
                if (!student) throw new Error('학생 데이터 없음');
                
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name}`);
                yPos = addPdfSectionTitle(pdf, '반 전체 주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos); 

                const commentText = document.getElementById('instructorComment')?.value ?? '';
                yPos = addPdfSectionTitle(pdf, '👨‍🏫 담당 강사 코멘트', yPos + 5);
                pdf.setDrawColor(107, 114, 128); pdf.setFillColor(243, 244, 246);
                pdf.rect(15, yPos, 180, 30, 'FD');
                addWrappedText(pdf, commentText || '(코멘트 없음)', yPos + 6, { x: 20, maxWidth: 170 });
                yPos += 40;
                
                if (chartImgData) {
                    yPos = addPdfSectionTitle(pdf, '📊 점수 분포표', yPos);
                    const imgProps = pdf.getImageProperties(chartImgData);
                    const imgHeight = Math.min((imgProps.height * 180) / imgProps.width, 100); 
                    if (yPos + imgHeight > 280) { pdf.addPage(); yPos = 20; }
                    pdf.addImage(chartImgData, 'PNG', (pdf.internal.pageSize.getWidth() - 180) / 2, yPos, 180, imgHeight);
                }

                pdf.addPage();
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (AI 분석)`);
                yPos = addPdfSectionTitle(pdf, '🤖 AI 종합 분석 (Flash)', 40);
                
                if (student.submitted) {
                    yPos = addAiAnalysisSection(pdf, '⭐ 강점', aiStudent?.strengths, yPos, 'blue');
                    yPos = addAiAnalysisSection(pdf, '⚠️ 약점', aiStudent?.weaknesses, yPos, 'red');
                    yPos = addAiAnalysisSection(pdf, '🚀 학습 추천', aiStudent?.recommendations, yPos, 'green');
                } else {
                    yPos = addAiAnalysisSection(pdf, '미응시', '응시 데이터가 없습니다.', yPos, 'gray');
                }

                pdf.addPage();
                addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (문항 정오표)`);
                yPos = addPdfSectionTitle(pdf, '📋 문항 정오표 (Pro Vision)', 40);
                
                const errataBody = student.answers.map((ans, i) => {
                    const analysis = masterAnalysisMap.get(ans.qNum);
                    return [
                        `${ans.qNum}번`,
                        cleanText(analysis?.unit || 'N/A'),
                        cleanText(analysis?.difficulty || 'N/A'),
                        ans.isCorrect ? 'O' : 'X',
                        `${data.answerRates[i] ?? 'N/A'}%` 
                    ];
                });
                
                autoTable(pdf, {
                    startY: yPos,
                    head: [['문항번호', '유형', '난이도', '정오', '정답률']],
                    body: errataBody,
                    theme: 'grid',
                    styles: { font: 'NotoSansKR', fontSize: 9, fontStyle: 'normal' },
                    headStyles: { font: 'NotoSansKR', fontStyle: 'normal', fillColor: [248, 250, 252], textColor: [55, 65, 81] },
                    didDrawCell: (d) => {
                        if (d.section === 'body' && d.column.index === 3 && d.cell.text[0] === 'X') {
                            d.cell.styles.textColor = [220, 38, 38];
                        }
                    }
                });

                // ⭐️ [오답 분석] 고해상도 통이미지 방식 (적분/리미트 완벽 지원)
                const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
                if (incorrectAnswers.length > 0) {
                    pdf.addPage();
                    addPdfTitle(pdf, `${selectedDate} Weekly Test`, `${selectedClass} / ${student.name} (오답 분석)`);
                    yPos = addPdfSectionTitle(pdf, '🔍 오답 분석 및 대응 방안 (Pro Vision)', 40);
                    
                    for (const ans of incorrectAnswers) {
                        const analysis = masterAnalysisMap.get(ans.qNum);
                        
                        if (yPos > 240) { pdf.addPage(); yPos = 20; }

                        let currentY = yPos + 8;

                        // 제목
                        pdf.setFontSize(11); pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(185, 28, 28);
                        pdf.text(`${ans.qNum}번 문항 (난이도: ${cleanText(analysis?.difficulty)})`, 20, currentY);
                        
                        pdf.setFontSize(10); pdf.setFont('NotoSansKR', 'normal'); pdf.setTextColor(80, 80, 80);
                        pdf.text(`유형: ${cleanText(analysis?.unit)}`, 100, currentY);
                        currentY += 8;

                        // ⭐️ 분석 포인트 (통 이미지 변환)
                        pdf.setFontSize(10); pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(0, 0, 0);
                        pdf.text("💡 핵심 분석:", 20, currentY);
                        
                        const analysisImg = await convertTextToHighResImage(
                            analysis?.analysis_point || '내용 없음', 
                            { width: 130, fontSize: 10, color: '#333333' }
                        );
                        
                        if (analysisImg) {
                            pdf.addImage(analysisImg.imgData, 'PNG', 45, currentY - 4, analysisImg.width, analysisImg.height);
                            currentY += analysisImg.height + 4;
                        } else {
                            // 실패 시 텍스트 백업
                            addWrappedText(pdf, analysis?.analysis_point, currentY, { x: 45, maxWidth: 130 });
                            currentY += 10;
                        }

                        // ⭐️ 솔루션 (통 이미지 변환)
                        pdf.setFont('NotoSansKR', 'bold'); pdf.setTextColor(0, 0, 0);
                        pdf.text("📚 학습 전략:", 20, currentY);
                        
                        const solImg = await convertTextToHighResImage(
                            analysis?.solution || '내용 없음',
                            { width: 130, fontSize: 10, color: '#333333' }
                        );

                        if (solImg) {
                            pdf.addImage(solImg.imgData, 'PNG', 45, currentY - 4, solImg.width, solImg.height);
                            currentY += solImg.height + 6;
                        } else {
                            addWrappedText(pdf, analysis?.solution, currentY, { x: 45, maxWidth: 130 });
                            currentY += 10;
                        }

                        const height = currentY - yPos;
                        pdf.setDrawColor(220, 220, 220);
                        pdf.setFillColor(254, 242, 242); 
                        pdf.rect(15, yPos, 180, height, 'S'); 
                        
                        yPos = currentY + 5;
                    }
                }
            } else {
                addPdfTitle(pdf, `${selectedClass} ${selectedDate} 주간테스트 리포트 (반 전체)`);
                yPos = addPdfSectionTitle(pdf, '주요 특징', 40);
                yPos = addFeaturesSection(pdf, data, yPos);
                if (chartImgData) {
                    const imgProps = pdf.getImageProperties(chartImgData);
                    const imgHeight = Math.min((imgProps.height * 180) / imgProps.width, 100);
                    pdf.addImage(chartImgData, 'PNG', (pdf.internal.pageSize.getWidth() - 180) / 2, yPos + 5, 180, imgHeight);
                    yPos += imgHeight + 15;
                }
                yPos = addAiAnalysisSection(pdf, '종합 총평', aiOverall?.summary, yPos, 'gray');
                yPos = addAiAnalysisSection(pdf, '공통 약점', aiOverall?.common_weaknesses, yPos, 'red');
                yPos = addAiAnalysisSection(pdf, '지도 방안', aiOverall?.recommendations, yPos, 'green');
            }
            
            pdf.save(`${selectedClass}_${selectedDate}_${reportType}.pdf`);

        } catch (error) {
            console.error("PDF Error:", error);
            setErrorMessage(`PDF 생성 실패: ${error.message}`);
        } finally {
            button.textContent = 'PDF로 저장';
            button.disabled = false;
        }
    }, [currentReportData, selectedClass, selectedDate, selectedStudent, setErrorMessage]); 

    return { handlePdfSave };
};