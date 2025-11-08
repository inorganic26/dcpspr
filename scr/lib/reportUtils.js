// scr/lib/reportUtils.js

import Chart from 'chart.js/auto';

/**
 * HTML 문자열 내의 AI 분석 스피너를 실제 내용으로 교체합니다.
 */
function replaceAISpinner(html, aiContent) {
    if (typeof aiContent !== 'string' || aiContent.trim() === '') {
        return html.replace(/<div class="ai-spinner"><\/div>/g, '<p class="text-gray-500">(AI 분석 내용을 생성하지 못했습니다.)</p>');
    }
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
    const submittedStudents = data.students.filter(s => s.submitted);
    let featuresHtml = '';

    if (submittedStudents.length === 0) {
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
        data.answerRates.forEach((rate, i) => {
            if (rate === 100) allCorrectQuestions.push(i + 1);
        });

        const highErrorRateQuestions = [];
        data.answerRates.forEach((rate, i) => {
            if (rate <= 40) highErrorRateQuestions.push({ qNum: i + 1, rate: rate });
        });

        featuresHtml = `
            <div id="pdf-section-features" class="card p-3 printable-section mb-2">
                <h3 class="text-xl font-bold text-gray-800 mb-2">💡 반 전체 주요 특징</h3>
                {/* ⭐️ [수정] align-items: start 제거 (높이 자동 정렬) */}
                <div class="grid md:grid-cols-3 gap-2">
                    
                    {/* ⭐️ [수정] 점수 분포 (파란색) - flex, max-h 추가 */}
                    <div class="bg-indigo-50 rounded border border-indigo-200 p-1 flex flex-col justify-between">
                        <h4 class="font-semibold text-indigo-800 text-sm mb-0.5">📈 점수 분포</h4>
                        <div class="flex-1 overflow-y-auto text-indigo-700 text-sm leading-tight break-words max-h-[5.5rem]">
                            최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${data.classAverage}점
                        </div>
                    </div>
                    
                    {/* ⭐️ [수정] 전원 정답 (녹색) - flex, max-h 추가 */}
                    <div class="bg-green-50 rounded border border-green-200 p-1 flex flex-col justify-between">
                        <h4 class="font-semibold text-green-800 text-sm mb-0.5">✅ 전원 정답 문항</h4>
                        <div class="flex-1 overflow-y-auto text-green-700 text-sm leading-tight break-words max-h-[5.5rem]">
                            ${allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음'}
                        </div>
                    </div>

                    {/* ⭐️ [수정] 오답 문항 (붉은색) - max-h 5.5rem으로 변경 */}
                    <div class="bg-red-50 rounded border border-red-200 p-1 flex flex-col justify-between">
                        <h4 class="font-semibold text-red-800 text-sm mb-0.5">❌ 오답률 높은 문항 (40% 이하)</h4>
                        <div class="flex-1 overflow-y-auto text-red-700 text-sm leading-tight break-words max-h-[5.5rem]">
                            ${highErrorRateQuestions.length > 0 
                                ? highErrorRateQuestions.map(q => `${q.qNum}번(${q.rate}%)`).join(', ')
                                : '없음'}
                        </div>
                    </div>
                    {/* --- [수정] 완료 --- */}
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
    const featuresHtml = generateOverallFeaturesHTML(data, aiOverallAnalysis); // ⭐️ 수정된 함수 호출

    // 1-2. AI 종합 분석 (차트 + 3개 분석)
    const summaryContent = aiOverallAnalysis ? aiOverallAnalysis.summary.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    const weaknessesContent = aiOverallAnalysis ? aiOverallAnalysis.common_weaknesses.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';
    const recommendationsContent = aiOverallAnalysis ? aiOverallAnalysis.recommendations.replace(/\n/g, ' ') : '<div class="ai-spinner"></div>';

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
    if (!student || !student.submitted) { 
        return `
            <div class="text-center my-4 print:hidden">
                <h2 class="text-3xl font-bold text-gray-800">${selectedClass} ${selectedDate}</h2>
                <p class="text-xl text-gray-600">${student ? student.name : '알 수 없음'} 학생 리포트</p>
            </div>
            <div class="card p-8 text-center">
                <p class="text-xl text-gray-600 p-8">해당 시험에 응시하지 않아 리포트를 생성할 수 없습니다.</p>
            </div>
        `;
    }

    // 2-2. 반 전체 주요 특징 (상단 3개 박스) - 재사용
    const featuresHtml = generateOverallFeaturesHTML(data, aiOverallAnalysis); // ⭐️ 수정된 함수 호출

    // 2-3. 강사 코멘트
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
    const scoreChartHtml = `
        <div id="pdf-section-chart" class="card p-6 printable-section" style="page-break-inside: avoid;">
            <h3 class="text-2xl font-bold text-gray-800 mb-4">📊 ${student.name} 학생 점수 분포</h3>
            <div class="w-full"><canvas id="scoreChart"></canvas></div>
        </div>
    `;

    // 2-4b. AI 종합 분석 박스 (2페이지용)
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
            <td class="px-4 py-3 text-center">${data.answerRates[i] ?? 'N/A'}%</td>
        </tr>
    `).join('');

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
            ${scoreChartHtml} 
        </div>
        
        <div class="report-page" data-page-name="AI 분석">
            ${aiAnalysisHtml} 
        </div>
        
        <div class="report-page" data-page-name="문항 정오표">
            ${errataHtml} 
        </div>

        <div class="report-page" data-page-name="오답 분석">
            ${solutionsHtml} 
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
    if (!studentData || !studentData.students) { 
         console.warn("renderScoreChart: studentData.students가 없습니다.");
         return null;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const submittedStudents = studentData.students.filter(s => s.submitted);
    const sortedStudents = [...submittedStudents].sort((a, b) => b.score - a.score);

    const labels = sortedStudents.map((s, index) => {
        if (currentStudent && s.name === currentStudent.name) {
            return s.name; // 현재 학생 이름 강조
        }
        return currentStudent ? `학생 ${index + 1}` : s.name;
    });

    const scores = sortedStudents.map(s => s.score);
    
    const backgroundColors = sortedStudents.map(s => {
        return currentStudent && s.name === currentStudent.name 
            ? 'rgba(59, 130, 246, 0.7)' 
            : 'rgba(156, 163, 175, 0.5)'; 
    });
     const borderColors = sortedStudents.map(s => {
        return currentStudent && s.name === currentStudent.name 
            ? 'rgba(37, 99, 235, 1)' 
            : 'rgba(107, 114, 128, 1)'; 
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
                borderColor: 'rgb(239, 68, 68)', 
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

    const labels = cumulativeData.map(d => d.date); 
    const studentScores = cumulativeData.map(d => d.studentScore); 
    const classAverages = cumulativeData.map(d => d.classAverage); 

    return new Chart(ctx, {
        type: 'line', 
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${studentName} 학생 점수`,
                    data: studentScores,
                    borderColor: 'rgba(59, 130, 246, 1)', 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: false,
                    tension: 0.1,
                    borderWidth: 3,
                }, 
                {
                    label: '반 평균',
                    data: classAverages,
                    borderColor: 'rgba(239, 68, 68, 1)', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: false,
                    tension: 0.1,
                    borderWidth: 2,
                    borderDash: [5, 5], 
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