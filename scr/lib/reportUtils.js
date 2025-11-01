import Chart from 'chart.js/auto';

/**
 * HTML 문자열 내의 AI 분석 스피너를 실제 내용으로 교체합니다.
 */
function replaceAISpinner(html, aiContent) {
    if (typeof aiContent !== 'string' || aiContent.trim() === '') {
        return html.replace(/<div class="ai-spinner"><\/div>/g, '<p class="text-gray-500">(AI 분석 내용을 생성하지 못했습니다.)</p>');
    }
    const formattedContent = aiContent.replace(/\n/g, '<br />');
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
 * ⭐️ [오류 수정]
 * 이 함수를 다른 함수들 밖으로 꺼내서,
 * generateOverallReportHTML와 generateIndividualReportHTML 모두가 접근할 수 있게 합니다.
 */
function generateOverallFeaturesHTML(data, aiOverallAnalysis) {
    const submittedStudents = data.studentData.students.filter(s => s.submitted);
    let featuresHtml = '';
    
    if (submittedStudents.length === 0) {
        featuresHtml = `<div class="card p-8 printable-section"><h3 class="section-title">💡 반 전체 주요 특징</h3><p class="text-center text-gray-500">제출한 학생이 없어 분석할 데이터가 없습니다.</p></div>`;
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

        featuresHtml = `
            <div id="pdf-section-features" class="card p-8 printable-section">
                <h3 class="section-title">💡 반 전체 주요 특징</h3>
                <div class="grid md:grid-cols-3 gap-6">
                    <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                        <h4 class="font-semibold text-indigo-800">📈 점수 분포</h4>
                        <p class="text-indigo-700 mt-2">최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${data.studentData.classAverage}점</p>
                    </div>
                    <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 class="font-semibold text-green-800">✅ 전원 정답 문항</h4>
                        <p class="text-green-700 mt-2">${allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음'}</p>
                    </div>
                    <div class="bg-red-50 p-4 rounded-lg border border-red-200">
                        <h4 class="font-semibold text-red-800">❌ 오답률 높은 문항 (40% 이하)</h4>
                        ${highErrorRateQuestions.length > 0 
                            ? highErrorRateQuestions.map(q => `<span class="text-red-700">${q.qNum}번 (${q.rate}%)</span>`).join(', ') 
                            : '<p class="text-red-700 mt-2">없음</p>'}
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
    // ⭐️ [오류 수정] 이제 외부 함수를 호출합니다.
    const featuresHtml = generateOverallFeaturesHTML(data, aiOverallAnalysis);

    // 1-2. AI 종합 분석 (차트 + 3개 분석)
    // aiOverallAnalysis가 로드되었는지 확인
    const summaryContent = aiOverallAnalysis ? aiOverallAnalysis.summary : '<div class="ai-spinner"></div>';
    const weaknessesContent = aiOverallAnalysis ? aiOverallAnalysis.common_weaknesses : '<div class="ai-spinner"></div>';
    const recommendationsContent = aiOverallAnalysis ? aiOverallAnalysis.recommendations : '<div class="ai-spinner"></div>';

    const aiAnalysisHtml = `
        <div id="pdf-section-ai-overall" class="card p-8 printable-section">
            <h3 class="section-title">🤖 반 전체 AI 종합 분석</h3>
            <div class="w-full mb-8"><canvas id="scoreChart"></canvas></div>
            <div class="space-y-6">
                <div class="p-6 rounded-lg bg-gray-100 border border-gray-200">
                    <h4 class="font-bold text-lg text-gray-800 mb-2">📊 종합 총평</h4>
                    <div class="text-gray-700 report-ai-content">${summaryContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-red-50 border-red-200">
                    <h4 class="font-bold text-lg text-red-800 mb-2">⚠️ 공통 약점 분석</h4>
                    <div class="text-red-700 report-ai-content">${weaknessesContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-green-50 border-green-200">
                    <h4 class="font-bold text-lg text-green-800 mb-2">🚀 수업 지도 방안</h4>
                    <div class="text-green-700 report-ai-content">${recommendationsContent}</div>
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
        <div id="pdf-section-solutions-overall" class="card p-8 printable-section">
            <h3 class="section-title">🔍 주요 오답 문항 분석 (AI 기반)</h3>
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
    // (페이지네이션을 위해 report-page 클래스로 래핑 - App.jsx에서 관리)
    return `
        <div class="text-center my-4 print:hidden">
            <h2 class="text-3xl font-bold text-gray-800">${selectedClass} ${selectedDate}</h2>
            <p class="text-xl text-gray-600">주간테스트 리포트 (반 전체)</p>
        </div>
        
        <div class="report-page active" data-page-name="종합 분석">
            ${featuresHtml}
            ${aiAnalysisHtml}
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
    // ⭐️ [오류 수정] 이제 외부 함수를 호출합니다.
    const featuresHtml = generateOverallFeaturesHTML(data, aiOverallAnalysis);

    // 2-3. 강사 코멘트
    // ⭐️ [디자인 수정]
    // '강점' 박스와 유사하게 파란색 테마(bg-blue-50)를 적용하여 디자인 통일성 확보
    const commentHtml = `
        <div id="pdf-section-comment" class="card p-8 printable-section">
            <h3 class="section-title">👨‍🏫 담당 강사 코멘트</h3>
            <div class="p-6 rounded-lg bg-blue-50 border border-blue-200">
                <textarea id="instructorComment" 
                    class="w-full h-40 p-3 bg-white border border-blue-200 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-150 ease-in-out" 
                    placeholder="강사님의 코멘트를 이곳에 입력해주세요..."></textarea>
            </div>
        </div>
    `;

    // 2-4. AI 종합 분석 (차트 + 3개 분석)
    // aiAnalysis가 로드되었는지 확인
    const strengthsContent = aiAnalysis ? aiAnalysis.strengths : '<div class="ai-spinner"></div>';
    const weaknessesContent = aiAnalysis ? aiAnalysis.weaknesses : '<div class="ai-spinner"></div>';
    const recommendationsContent = aiAnalysis ? aiAnalysis.recommendations : '<div class="ai-spinner"></div>';
    
    const aiAnalysisHtml = `
        <div id="pdf-section-ai" class="card p-8 printable-section">
            <h3 class="section-title">🤖 ${student.name} 학생 AI 종합 분석</h3>
            <div class="w-full mb-8"><canvas id="scoreChart"></canvas></div>
            <div class="space-y-6">
                <div class="p-6 rounded-lg bg-blue-50 border border-blue-200">
                    <h4 class="font-bold text-lg text-blue-800 mb-2">⭐ 강점 (Strengths)</h4>
                    <div class="text-blue-700 report-ai-content">${strengthsContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-red-50 border-red-200">
                    <h4 class="font-bold text-lg text-red-800 mb-2">⚠️ 약점 (Weaknesses)</h4>
                    <div class="text-red-700 report-ai-content">${weaknessesContent}</div>
                </div>
                <div class="p-6 rounded-lg bg-green-50 border-green-200">
                    <h4 class="font-bold text-lg text-green-800 mb-2">🚀 학습 추천 (Recommendations)</h4>
                    <div class="text-green-700 report-ai-content">${recommendationsContent}</div>
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

    const errataHtml = `
        <div id="pdf-section-errata" class="card p-8 printable-section">
            <h3 class="section-title">📋 문항 정오표</h3>
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
        <div id="pdf-section-solutions" class="card p-8 printable-section">
            <h3 class="section-title">🔍 오답 분석 및 대응 방안 (AI 기반)</h3>
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
    // (페이지네이션을 위해 report-page 클래스로 래핑 - App.jsx에서 관리)
    return `
        <div class="text-center my-4 print:hidden">
            <h2 class="text-3xl font-bold text-gray-800">${selectedClass} ${selectedDate}</h2>
            <p class="text-xl text-gray-600">${student.name} 학생 리포트</p>
        </div>

        <div class="report-page active" data-page-name="종합 분석">
            ${featuresHtml}
            ${commentHtml}
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
 * 3. 차트 렌더링
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