// scr/lib/reportUtils.js

import Chart from 'chart.js/auto';

/**
 * HTML 문자열 내의 AI 분석 스피너를 실제 내용으로 교체합니다.
 */
function replaceAISpinner(html, aiContent) {
    if (typeof aiContent !== 'string' || aiContent.trim() === '') {
        return html.replace(/<div class="ai-spinner"><\/div>/g, '<p class="text-gray-500">(AI 분석 내용을 생성하지 못했습니다.)</p>');
    }
    // [수정] AI가 생성한 줄바꿈(\n)을 공백(' ')으로 변경하여 한 줄로 잇습니다.
    const formattedContent = aiContent.replace(/\n/g, ' ');
    return html.replace(/<div class="ai-spinner"><\/div>/g, formattedContent);
}

/**
 * 난이도를 반환하는 헬퍼 함수
 */
function getDifficulty(qNum, selectedClass) {
    if (!selectedClass) return '정보 없음';
    if (selectedClass.includes('고1')) {
        if (qNum >= 18) return '어려움';
        if (qNum >= 9) return '보통';
        return '쉬움';
    } else {
        // (고2 이상 또는 기본값)
        if ([14, 15, 17, 18, 19, 21].includes(qNum)) return '어려움';
        if ([6, 7, 8, 9, 10, 11, 12, 13, 16, 20].includes(qNum)) return '보통';
        return '쉬움';
    }
}

/**
 * ⭐️ [수정] '여백 최소화' + '높이 정렬(start)' 버전으로 함수 교체
 */
function generateOverallFeaturesHTML(data, aiOverallAnalysis) {
    const submittedStudents = data.studentData.students.filter(s => s.submitted);
    let featuresHtml = '';

    if (submittedStudents.length === 0) {
        // 🔧 여백 최소화 버전 (p-3, mb-2, text-sm)
        featuresHtml = `
            <div class="card p-3 printable-section mb-2">
                <h3 class="text-xl font-bold text-gray-800 mb-2">💡 반 전체 주요 특징</h3>
                <p class="text-center text-gray-500 text-sm leading-tight">제출한 학생이 없어 분석할 데이터가 없습니다.</p>
            </div>`;
    } else {
        const scores = submittedStudents.map(s => s.score);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);

        const allCorrectQuestions = [];
        data.studentData.answerRates.forEach((rate, i) => {
            if (rate === 100) allCorrectQuestions.push(i + 1);
        });

        const highErrorRateQuestions = [];
        data.studentData.answerRates.forEach((rate, i) => {
            if (rate <= 40) highErrorRateQuestions.push({ qNum: i + 1, rate: rate });
        });

        // 🔧 여백 최소화 버전 (p-3, mb-2, gap-2, p-1, text-sm)
        // ⭐️ [수정] style="align-items: start;" 를 다시 추가하여 박스 높이가 강제로 늘어나는 것을 방지합니다.
        featuresHtml = `
            <div id="pdf-section-features" class="card p-3 printable-section mb-2">
                <h3 class="text-xl font-bold text-gray-800 mb-2">💡 반 전체 주요 특징</h3>
                <div class="grid md:grid-cols-3 gap-2" style="align-items: start;">
                    <div class="bg-indigo-50 rounded border border-indigo-200 p-1">
                        <h4 class="font-semibold text-indigo-800 text-sm mb-0.5">📈 점수 분포</h4>
                        <p class="text-indigo-700 text-sm leading-tight">
                            최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${data.studentData.classAverage}점
                        </p>
                    </div>
                    <div class="bg-green-50 rounded border border-green-200 p-1">
                        <h4 class="font-semibold text-green-800 text-sm mb-0.5">✅ 전원 정답 문항</h4>
                        <p class="text-green-700 text-sm leading-tight">
                            ${allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음'}
                        </p>
                    </div>
                    <div class="bg-red-50 rounded border border-red-200 p-1">
                        <h4 class="font-semibold text-red-800 text-sm mb-0.5">❌ 오답률 높은 문항 (40% 이하)</h4>
                        <p class="text-red-700 text-sm leading-tight break-words">
                            ${highErrorRateQuestions.length > 0 
                                ? highErrorRateQuestions.map(q => `${q.qNum}번(${q.rate}%)`).join(', ')
                                : '없음'}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
    return featuresHtml;
}


/**
 * ----------------------------------------------------------------
 * 1. 반 전체 리포트 HTML 생성
 * ----------------------------------------------------------------
 */
export function generateOverallReportHTML(data, aiOverallAnalysis, selectedClass, selectedDate) {
    
    // 1-1. 반 전체 주요 특징 (상단 3개 박스)
    const featuresHtml = generateOverallFeaturesHTML(data, aiOverallAnalysis); // ⭐️ '여백 최소화' + '높이 정렬(start)' 버전 적용됨

    // 1-2. AI 종합 분석 (차트 + 3개 분석)
    const summaryContent = aiOverallAnalysis ? aiOverallAnalysis.summary.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    const weaknessesContent = aiOverallAnalysis ? aiOverallAnalysis.common_weaknesses.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    const recommendationsContent = aiOverallAnalysis ? aiOverallAnalysis.recommendations.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';

    // ⭐️ [수정] 'aiAnalysisHtml'을 'scoreChartHtml'과 'aiBoxesHtml'로 분리합니다.

    // 1-2a. 점수 차트 (1페이지용)
    const scoreChartHtml = `
        <div id="pdf-section-chart-overall" class="card p-6 printable-section" style="page-break-inside: avoid;">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">📊 반 전체 점수 분포</h3>
            <div class="w-full"><canvas id="scoreChart"></canvas></div>
        </div>
    `;

    // 1-2b. AI 종합 분석 박스 (2페이지용)
    const aiBoxesHtml = `
        <div id="pdf-section-ai-boxes-overall" class="card p-6 printable-section" style="page-break-inside: avoid;">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">🤖 반 전체 AI 종합 분석</h3>
            <div class="space-y-6">
                <div class="p-6 rounded-lg bg-gray-100 border border-gray-200">
                    <h4 class="font-bold text-lg text-gray-800 mb-2">📊 종합 총평</h4>
                    <div class="text-gray-700 report-ai-content max-w-none">${summaryContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-red-50 border-red-200">
                    <h4 class="font-bold text-lg text-red-800 mb-2">⚠️ 공통 약점 분석</h4>
                    <div class="text-red-700 report-ai-content max-w-none">${weaknessesContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-green-50 border-green-200">
                    <h4 class="font-bold text-lg text-green-800 mb-2">🚀 수업 지도 방안</h4>
                    <div class="text-green-700 report-ai-content max-w-none">${recommendationsContent}</div>
                </div>
            </div>
        </div>
    `;

    // 1-3. 주요 오답 문항 분석 (테이블)
    let questionAnalysisRows = '<tr><td colspan="4" class="text-center py-4">AI 분석 대기 중...</td></tr>';
    if (aiOverallAnalysis) {
        if (aiOverallAnalysis.question_analysis && aiOverallAnalysis.question_analysis.length > 0) {
            questionAnalysisRows = aiOverallAnalysis.question_analysis.map(item => `
                <tr class="border-b bg-red-50 hover:bg-red-100">
                    <td class="px-4 py-3 text-center font-medium">${item.qNum}번</td>
                    <td class="px-6 py-3">${item.unit || '분석 중...'}</td>
                    <td class="px-6 py-3">${item.analysis_point || '분석 중...'}</td>
                    <td class="px-6 py-3">${item.solution || '분석 중...'}</td>
                </tr>
            `).join('');
        } else {
            questionAnalysisRows = '<tr><td colspan="4" class="text-center py-4">주요 오답 문항이 없습니다.</td></tr>';
        }
    }

    // (page-break-inside: avoid 제거 - 테이블은 잘려도 됨)
    const solutionsHtml = `
        <div id="pdf-section-solutions-overall" class="card p-6 printable-section">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">🔍 주요 오답 문항 분석 (AI 기반)</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-center">문항번호</th>
                            <th class="px-6 py-3">세부 개념 유형 (AI)</th>
                            <th class="px-6 py-3">핵심 분석</th>
                            <th class="px-6 py-3">지도 방안</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${questionAnalysisRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 1-4. HTML 조합
    // ⭐️ [수정] '종합 분석' 페이지를 '특징+차트' / 'AI분석' 2페이지로 분리
    return `
        <div class="text-center my-4 print:hidden">
            <h2 class="text-3xl font-bold text-gray-800">${selectedClass} ${selectedDate}</h2>
            <p class="text-xl text-gray-600">주간테스트 리포트 (반 전체)</p>
        </div>
        
        <div class="report-page active" data-page-name="종합 분석">
            ${featuresHtml}
            ${scoreChartHtml}
        </div>
        
        <div class="report-page" data-page-name="AI 분석">
            ${aiBoxesHtml}
        </div>

        <div class="report-page" data-page-name="오답 문항 분석">
            ${solutionsHtml}
        </div>
    `;
}


/**
 * ----------------------------------------------------------------
 * 2. 학생 개별 리포트 HTML 생성
 * ----------------------------------------------------------------
 */
export function generateIndividualReportHTML(student, data, aiAnalysis, aiOverallAnalysis, selectedClass, selectedDate) {
    
    // 2-1. 미응시 학생 처리
    if (!student.submitted) {
        return `
            <div class="text-center my-4 print:hidden">
                <h2 class="text-3xl font-bold text-gray-800">${selectedClass} ${selectedDate}</h2>
                <p class="text-xl text-gray-600">${student.name} 학생 리포트</p>
            </div>
            <div class="card p-8 text-center">
                <p class="text-xl text-gray-600 p-8">해당 시험에 응시하지 않아 리포트를 생성할 수 없습니다.</p>
            </div>
        `;
    }

    // 2-2. 반 전체 주요 특징 (상단 3개 박스) - 재사용
    const featuresHtml = generateOverallFeaturesHTML(data, aiOverallAnalysis); // ⭐️ '여백 최소화' + '높이 정렬(start)' 버전 적용됨

    // 2-3. 강사 코멘트
    // (page-break-inside: avoid 제거)
    const commentHtml = `
        <div id="pdf-section-comment" class="card p-6 printable-section">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">👨‍🏫 담당 강사 코멘트</h3>
            <div class="p-6 rounded-lg bg-blue-50 border border-blue-200">
                <textarea id="instructorComment" 
                    class="w-full h-40 p-3 bg-white border border-blue-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-150 ease-in-out" 
                    placeholder="강사님의 코멘트를 이곳에 입력해주세요..."></textarea>
            </div>
        </div>
    `;

    // 2-4. AI 종합 분석 (차트 + 3개 분석)
    const strengthsContent = aiAnalysis ? aiAnalysis.strengths.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    const weaknessesContent = aiAnalysis ? aiAnalysis.weaknesses.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    const recommendationsContent = aiAnalysis ? aiAnalysis.recommendations.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    
    // 2-4a. 점수 차트 (1페이지용)
    // (page-break-inside: avoid; 유지 - 차트는 통째로)
    const scoreChartHtml = `
        <div id="pdf-section-chart" class="card p-6 printable-section" style="page-break-inside: avoid;">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">📊 ${student.name} 학생 점수 분포</h3>
            <div class="w-full"><canvas id="scoreChart"></canvas></div>
        </div>
    `;

    // 2-4b. AI 종합 분석 박스 (2페이지용)
    // (page-break-inside: avoid; 유지 - AI 분석 박스들은 통째로)
    const aiAnalysisHtml = `
        <div id="pdf-section-ai-boxes" class="card p-6 printable-section" style="page-break-inside: avoid;">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">🤖 ${student.name} 학생 AI 종합 분석</h3>
            
            <div class="space-y-6">
                <div class="p-6 rounded-lg bg-blue-50 border border-blue-200">
                    <h4 class="font-bold text-lg text-blue-800 mb-2">⭐ 강점 (Strengths)</h4>
                    <div class="text-blue-700 report-ai-content max-w-none">${strengthsContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-red-50 border-red-200">
                    <h4 class="font-bold text-lg text-red-800 mb-2">⚠️ 약점 (Weaknesses)</h4>
                    <div class="text-red-700 report-ai-content max-w-none">${weaknessesContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-green-50 border-green-200">
                    <h4 class="font-bold text-lg text-green-800 mb-2">🚀 학습 추천 (Recommendations)</h4>
                    <div class="text-green-700 report-ai-content max-w-none">${recommendationsContent}</div>
                </div>
            </div>
        </div>
    `;

    // 2-5. 단원 매핑 (AI 분석 결과 + 기본 맵)
    const unitMap = new Map();
    data.questionUnitMap?.question_units?.forEach(item => unitMap.set(item.qNum, item.unit));
    aiAnalysis?.incorrect_analysis?.forEach(item => {
        if (item.unit) unitMap.set(item.qNum, item.unit);
    });

    // 2-6. 문항 정오표 (테이블)
    const errataRows = student.answers.map((ans, i) => `
        <tr class="border-b ${!ans.isCorrect ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}">
            <td class="px-4 py-3 text-center font-medium ${!ans.isCorrect ? 'text-red-600' : ''}">${ans.qNum}번</td>
            <td class="px-6 py-3">${unitMap.get(ans.qNum) || ''}</td>
            <td class="px-4 py-3 text-center">${getDifficulty(ans.qNum, selectedClass)}</td>
            <td class="px-4 py-3 text-center font-bold ${ans.isCorrect ? 'text-blue-600' : 'text-red-600'}">${ans.isCorrect ? 'O' : 'X'}</td>
            <td class="px-4 py-3 text-center">${data.studentData.answerRates[i] ?? 'N/A'}%</td>
        </tr>
    `).join('');

    // (page-break-inside: avoid 제거 - 테이블은 잘려도 됨)
    const errataHtml = `
        <div id="pdf-section-errata" class="card p-6 printable-section">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">📋 문항 정오표</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-center">문항번호</th>
                            <th class="px-6 py-3">세부 개념 유형 (AI 분석)</th>
                            <th class="px-4 py-3 text-center">난이도</th>
                            <th class="px-4 py-3 text-center">정오</th>
                            <th class="px-4 py-3 text-center">반 전체 정답률(%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${errataRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 2-7. 오답 분석 및 대응 방안 (테이블)
    let incorrectAnalysisRows = '<tr><td colspan="5" class="text-center py-4">AI 분석 대기 중...</td></tr>';
    if (aiAnalysis) {
        if (aiAnalysis.incorrect_analysis && aiAnalysis.incorrect_analysis.length > 0) {
            incorrectAnalysisRows = aiAnalysis.incorrect_analysis.map(item => `
                <tr class="border-b bg-red-50 hover:bg-red-100">
                    <td class="px-4 py-3 text-center font-medium">${item.qNum}번</td>
                    <td class="px-6 py-3">${unitMap.get(item.qNum) || '분석 필요'}</td>
                    <td class="px-4 py-3 text-center">${getDifficulty(item.qNum, selectedClass)}</td>
                    <td class="px-6 py-3">${item.analysis_point || 'AI 분석 중...'}</td>
                    <td class="px-6 py-3">${item.solution || 'AI 분석 중...'}</td>
                </tr>
            `).join('');
        } else {
            incorrectAnalysisRows = '<tr><td colspan="5" class="text-center py-4">틀린 문항이 없습니다!</td></tr>';
        }
    }
    
    // (page-break-inside: avoid 제거 - 테이블은 잘려도 됨)
    const solutionsHtml = `
        <div id="pdf-section-solutions" class="card p-6 printable-section">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">🔍 오답 분석 및 대응 방안 (AI 기반)</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left text-gray-500">
                    <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-center">문항번호</th>
                            <th class="px-6 py-3">세부 개념 유형</th>
                            <th class="px-4 py-3 text-center">난이도</th>
                            <th class="px-6 py-3">분석 포인트 (AI)</th>
                            <th class="px-6 py-3">대응 방안 (AI)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${incorrectAnalysisRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // 2-8. HTML 조합
    return `
        <div class="text-center my-4 print:hidden">
            <h2 class="text-3xl font-bold text-gray-800">${selectedClass} ${selectedDate}</h2>
            <p class="text-xl text-gray-600">${student.name} 학생 리포트</p>
        </div>

        <div class="report-page active" data-page-name="종합 분석">
            ${featuresHtml}
            ${commentHtml}
            ${scoreChartHtml} {/* 1. 차트 (avoid 유지) */}
        </div>
        
        <div class="report-page" data-page-name="AI 분석">
            ${aiAnalysisHtml} {/* 2. AI 박스 (avoid 유지) */}
        </div>
        
        <div class="report-page" data-page-name="문항 정오표">
            ${errataHtml} {/* 3. 정오표 (avoid 제거) */}
        </div>

        <div class="report-page" data-page-name="오답 분석">
            ${solutionsHtml} {/* 4. 오답 분석 (avoid 제거) */}
        </div>
    `;
}


/**
 * ----------------------------------------------------------------
 * 3. 차트 렌더링 (단일 시험용)
 * ----------------------------------------------------------------
 */
export function renderScoreChart(canvas, studentData, currentStudent) {
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const submittedStudents = studentData.students.filter(s => s.submitted);
    const sortedStudents = [...submittedStudents].sort((a, b) => b.score - a.score);

    const labels = sortedStudents.map((s, index) => {
        if (currentStudent && s.name === currentStudent.name) {
            return s.name; // 현재 학생 이름 강조
        }
        // 반 전체 리포트에서는 모든 이름을 익명 처리
        return currentStudent ? `학생 ${index + 1}` : s.name;
    });

    const scores = sortedStudents.map(s => s.score);
    
    const backgroundColors = sortedStudents.map(s => {
        return currentStudent && s.name === currentStudent.name 
            ? 'rgba(59, 130, 246, 0.7)' // 'blue-500' (현재 학생)
            : 'rgba(156, 163, 175, 0.5)'; // 'gray-400' (다른 학생)
    });
     const borderColors = sortedStudents.map(s => {
        return currentStudent && s.name === currentStudent.name 
            ? 'rgba(37, 99, 235, 1)' // 'blue-600'
            : 'rgba(107, 114, 128, 1)'; // 'gray-500'
    });

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: currentStudent ? '학생 점수' : '학생별 점수',
                data: scores,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                order: 2
            }, {
                label: '반 평균',
                data: Array(scores.length).fill(studentData.classAverage),
                type: 'line',
                fill: false,
                borderColor: 'rgb(239, 68, 68)', // 'red-500'
                backgroundColor: 'rgb(239, 68, 68)',
                tension: 0.1,
                borderWidth: 3,
                pointRadius: 0,
                order: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    max: 100 
                },
                x: {
                    ticks: {
                        // 반 전체 리포트이고 학생 수가 10명 초과 시 이름 숨기기
                        display: (currentStudent || sortedStudents.length <= 10)
                    }
                }
            },
            plugins: {
                title: { 
                    display: true, 
                    text: '반 전체 점수 분포 (제출자)', 
                    font: { size: 16 } 
                },
                legend: { 
                    position: 'bottom' 
                },
                tooltip: {
                    callbacks: {
                        // 반 전체 리포트에서만 실제 학생 이름 표시
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.type === 'line') {
                                label = '반 평균';
                            } else {
                                label = currentStudent ? context.label : sortedStudents[context.dataIndex].name;
                            }
                            
                            if (context.parsed.y !== null) {
                                label += `${context.parsed.y}점`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * ----------------------------------------------------------------
 * 4. [신규] 누적 성적 추이 차트 렌더링 (라인 차트)
 * (이 함수는 '개별 리포트'에서 호출되지 않으며, '누적 리포트' 전용입니다.)
 * ----------------------------------------------------------------
 */
export function renderCumulativeScoreChart(canvas, cumulativeData, studentName) {
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 데이터 포맷팅
    const labels = cumulativeData.map(d => d.date); // X축 (날짜)
    const studentScores = cumulativeData.map(d => d.studentScore); // Y축 (학생 점수)
    const classAverages = cumulativeData.map(d => d.classAverage); // Y축 (반 평균)

    return new Chart(ctx, {
        type: 'line', // 차트 타입을 'line'으로 변경
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${studentName} 학생 점수`,
                    data: studentScores,
                    borderColor: 'rgba(59, 130, 246, 1)', // 'blue-500'
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: false,
                    tension: 0.1,
                    borderWidth: 3,
                }, 
                {
                    label: '반 평균',
                    data: classAverages,
                    borderColor: 'rgba(239, 68, 68, 1)', // 'red-500'
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: false,
                    tension: 0.1,
                    borderWidth: 2,
                    borderDash: [5, 5], // 평균은 점선으로 표시
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: { 
                y: { 
                    beginAtZero: true, 
                    max: 100 
                },
                x: {
                    ticks: {
                        // 날짜가 너무 많으면 일부만 표시
                        autoSkip: true,
                        maxTicksLimit: 10 
                    }
                }
            },
            plugins: {
                title: { 
                    display: true, 
                    text: `${studentName} 학생 성적 추이 (vs 반 평균)`, 
                    font: { size: 16 } 
                },
                legend: { 
                    position: 'bottom' 
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += `${context.parsed.y}점`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}