import Chart from 'chart.js/auto';

// --- HTML 생성 및 차트 렌더링 헬퍼 ---

// 이 함수들은 App.jsx에서 state(selectedClass, testData 등)를 받아야 합니다.

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

export function generateOverallFeaturesHTML(data, aiOverallAnalysis = null) {
    if (!data || !data.studentData || !Array.isArray(data.studentData.students) || !Array.isArray(data.studentData.answerRates)) {
        console.error("Invalid data structure for generateOverallFeaturesHTML", data);
        return '<div class="card p-8 printable-section"><h3 class="section-title">💡 반 전체 주요 특징</h3><p class="text-center text-red-500">리포트 특징을 표시할 데이터가 부족하거나 형식이 올바르지 않습니다.</p></div>';
    }
    const submittedStudents = data.studentData.students.filter(s => s.submitted);
    if (submittedStudents.length === 0) {
        return `<div id="pdf-section-features" class="card p-8 printable-section"><h3 class="section-title">💡 반 전체 주요 특징</h3><p class="text-center text-gray-500">제출한 학생이 없어 분석할 데이터가 없습니다.</p></div>`;
    }
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
    let highErrorContent = '';
    if (highErrorRateQuestions.length > 0) {
        highErrorContent = highErrorRateQuestions.map(q => {
            const aiAnalysisForQuestion = aiOverallAnalysis?.question_analysis?.find(item => item.qNum === q.qNum);
            const analysisComment = aiAnalysisForQuestion?.analysis_point || 'AI 분석 대기 중...';
            return `<div class="mt-2">
                        <p class="text-red-700 font-semibold">${q.qNum}번 (정답률 ${q.rate}%)</p>
                        <p class="text-xs text-gray-600 ml-2">- AI 코멘트: ${analysisComment}</p>
                    </div>`;
        }).join('');
    } else {
        highErrorContent = '<p class="text-red-700 mt-2">없음</p>';
    }
    return `
        <div id="pdf-section-features" class="card p-8 printable-section">
            <h3 class="section-title">💡 반 전체 주요 특징</h3>
            <div class="grid md:grid-cols-3 gap-6">
                <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <h4 class="font-semibold text-indigo-800">📈 점수 분포</h4>
                    <p class="text-indigo-700 mt-2">최고 ${maxScore}점, 최저 ${minScore}점, 평균 ${classAverage}점</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 class="font-semibold text-green-800">✅ 전원 정답 문항</h4>
                    <p class="text-green-700 mt-2">${allCorrectQuestions.length > 0 ? allCorrectQuestions.map(q => `${q}번`).join(', ') : '없음'}</p>
                </div>
                <div class="bg-red-50 p-4 rounded-lg border border-red-200">
                    <h4 class="font-semibold text-red-800">❌ 오답률 높은 문항 (정답률 40% 이하)</h4>
                    ${highErrorContent}
                </div>
            </div>
        </div>
    `;
}

export function generateOverallReportHTML(data, aiAnalysis, selectedClass, selectedDate) {
    const formatAIResponse = (content) => {
        if (typeof content === 'string') return content.replace(/\n/g, '<br>');
        return 'AI 분석 결과가 없거나 형식이 올바르지 않습니다.';
    };
    const summaryContent = aiAnalysis === undefined ? '<div class="spinner"></div>' : formatAIResponse(aiAnalysis?.summary);
    const weaknessesContent = aiAnalysis === undefined ? '<div class="spinner"></div>' : formatAIResponse(aiAnalysis?.common_weaknesses);
    const recommendationsContent = aiAnalysis === undefined ? '<div class="spinner"></div>' : formatAIResponse(aiAnalysis?.recommendations);
    const questionAnalysisRows = aiAnalysis?.question_analysis?.length > 0
        ? aiAnalysis.question_analysis.map(item => `
            <tr class="border-b bg-red-50">
                <td class="px-4 py-3 text-center font-medium">${item.qNum || 'N/A'}번</td>
                <td class="px-6 py-3">${item.unit || '분석 중...'}</td>
                <td class="px-6 py-3">${item.analysis_point || '분석 중...'}</td>
                <td class="px-6 py-3">${item.solution || '분석 중...'}</td>
            </tr>
        `).join('')
        : aiAnalysis === null ? '<tr><td colspan="4" class="text-center py-4 text-red-500">AI 분석 실패</td></tr>'
        : '<tr><td colspan="4" class="text-center py-4">주요 오답 문항이 없습니다.</td></tr>';
    return `
        <div id="printable-area">
            <div class="text-center my-4">
                <h2 class="text-2xl font-bold">${selectedClass} ${selectedDate} 주간테스트 리포트 (반 전체)</h2>
            </div>
            ${generateOverallFeaturesHTML(data, aiAnalysis)}
            <div id="pdf-section-ai-overall" class="card p-8 printable-section">
                <h3 class="section-title">🤖 반 전체 AI 종합 분석</h3>
                <div class="w-full mb-8"><canvas id="scoreChart"></canvas></div>
                <div class="space-y-6">
                    <div class="p-6 rounded-lg bg-gray-100 border border-gray-200">
                        <h4 class="font-bold text-lg text-gray-800 mb-2">📊 종합 총평</h4>
                        <div class="text-gray-700">${summaryContent}</div>
                    </div>
                    <div class="p-6 rounded-lg bg-red-50 border-red-200">
                        <h4 class="font-bold text-lg text-red-800 mb-2">⚠️ 공통 약점 분석</h4>
                        <div class="text-red-700">${weaknessesContent}</div>
                    </div>
                    <div class="p-6 rounded-lg bg-green-50 border-green-200">
                        <h4 class="font-bold text-lg text-green-800 mb-2">🚀 수업 지도 방안</h4>
                        <div class="text-green-700">${recommendationsContent}</div>
                    </div>
                </div>
            </div>
            <div id="pdf-section-solutions-overall" class="card p-8 printable-section">
                <h3 class="section-title">🔍 주요 오답 문항 분석 (AI 기반)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left text-gray-500">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-center">문항번호</th>
                                <th class="px-6 py-3">세부 개념 유형 (AI 분석)</th>
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
        </div>
    `;
}

export function generateIndividualReportHTML(student, data, aiAnalysis, aiOverallAnalysis, selectedClass, selectedDate) {
    if (!student) return '<p>학생 데이터 오류</p>';
    if (!student.submitted) {
        return `
            <div class="text-center my-4"> <h2 class="text-2xl font-bold">${selectedClass} ${selectedDate} 주간테스트 리포트</h2> </div>
            <div class="card p-8 text-center"> <h3 class="section-title">${student.name} 학생 리포트</h3> <p class="text-xl text-gray-600 p-8">해당 시험에 응시하지 않아 리포트를 생성할 수 없습니다.</p> </div>
        `;
    }
    const formatAIResponse = (content) => {
        if (typeof content === 'string') return content.replace(/\n/g, '<br>');
        return 'AI 분석 결과가 없거나 형식이 올바르지 않습니다.';
    };
    const strengthsContent = aiAnalysis === undefined ? '<div class="spinner"></div>' : formatAIResponse(aiAnalysis?.strengths);
    const weaknessesContent = aiAnalysis === undefined ? '<div class="spinner"></div>' : formatAIResponse(aiAnalysis?.weaknesses);
    const recommendationsContent = aiAnalysis === undefined ? '<div class="spinner"></div>' : formatAIResponse(aiAnalysis?.recommendations);
    const unitMap = new Map();
    if (data?.questionUnitMap?.question_units) {
        data.questionUnitMap.question_units.forEach(item => unitMap.set(item.qNum, item.unit));
    }
    if (aiAnalysis?.incorrect_analysis) {
        aiAnalysis.incorrect_analysis.forEach(item => { if (item.unit) unitMap.set(item.qNum, item.unit); });
    }
    const incorrectAnalysisRows = Array.isArray(aiAnalysis?.incorrect_analysis) && aiAnalysis.incorrect_analysis.length > 0
        ? aiAnalysis.incorrect_analysis.map(item => `
            <tr class="border-b bg-red-50">
                <td class="px-4 py-3 text-center font-medium">${item.qNum || 'N/A'}번</td>
                <td class="px-6 py-3">${unitMap.get(item.qNum) || '분석 필요'}</td>
                <td class="px-4 py-3 text-center">${getDifficulty(item.qNum, selectedClass)}</td>
                <td class="px-6 py-3">${item.analysis_point || 'AI 분석 중...'}</td>
                <td class="px-6 py-3">${item.solution || 'AI 분석 중...'}</td>
            </tr>
        `).join('')
        : aiAnalysis === null ? '<tr><td colspan="5" class="text-center py-4 text-red-500">AI 분석 실패</td></tr>'
        : '<tr><td colspan="5" class="text-center py-4">오답 문항이 없습니다!</td></tr>';
    return `
        <div id="printable-area">
            <div class="report-page active" data-page-name="종합 분석">
                 <div class="text-center my-4"> <h2 class="text-2xl font-bold">${selectedClass} ${selectedDate} 주간테스트 리포트</h2> </div>
                ${generateOverallFeaturesHTML(data, aiOverallAnalysis)}
                <div id="pdf-section-comment" class="card p-8 printable-section"> <h3 class="section-title">👨‍🏫 담당 강사 코멘트</h3> <div class="p-6 rounded-lg bg-sky-50 border-sky-200"> <textarea id="instructorComment" class="w-full h-40 p-2 border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-400 focus:outline-none" placeholder="강사님의 코멘트를 직접 입력해주세요..."></textarea> </div> </div>
                <div id="pdf-section-ai" class="card p-8 printable-section"> <h3 class="section-title">🤖 ${student.name} 학생 AI 종합 분석</h3> <div class="w-full mb-8"><canvas id="scoreChart"></canvas></div> <div class="space-y-6"> <div class="p-6 rounded-lg bg-blue-50 border border-blue-200"> <h4 class="font-bold text-lg text-blue-800 mb-2">⭐ 강점 (Strengths)</h4> <div class="text-blue-700">${strengthsContent}</div> </div> <div class="p-6 rounded-lg bg-red-50 border-red-200"> <h4 class="font-bold text-lg text-red-800 mb-2">⚠️ 약점 (Weaknesses)</h4> <div class="text-red-700">${weaknessesContent}</div> </div> <div class="p-6 rounded-lg bg-green-50 border-green-200"> <h4 class="font-bold text-lg text-green-800 mb-2">🚀 학습 추천 (Recommendations)</h4> <div class="text-green-700">${recommendationsContent}</div> </div> </div> </div>
            </div>
            <div class="report-page" data-page-name="문항 정오표">
                 <div class="text-center my-4"> <h2 class="text-2xl font-bold">${selectedClass} ${selectedDate} 주간테스트 리포트</h2> </div>
                <div id="pdf-section-errata" class="card p-8 printable-section"> <h3 class="section-title">📋 문항 정오표</h3> <div class="overflow-x-auto"> <table class="w-full text-sm text-left text-gray-500"> <thead class="text-xs text-gray-700 uppercase bg-gray-50"> <tr> <th class="px-4 py-3 text-center">문항번호</th> <th class="px-6 py-3">세부 개념 유형 (AI 분석)</th> <th class="px-4 py-3 text-center">난이도</th> <th class="px-4 py-3 text-center">정오</th> <th class="px-4 py-3 text-center">반 전체 정답률(%)</th> </tr> </thead> <tbody> ${student.answers && Array.isArray(student.answers) ? student.answers.map((ans, i) => `<tr class="border-b ${!ans.isCorrect ? 'bg-red-50' : (i % 2 === 0 ? 'bg-white' : '')}"><td class="px-4 py-3 text-center font-medium ${!ans.isCorrect ? 'text-red-600' : ''}">${ans.qNum}번</td><td class="px-6 py-3">${(data?.questionUnitMap?.question_units.find(item => item.qNum === ans.qNum) || {}).unit || ''}</td><td class="px-4 py-3 text-center">${getDifficulty(ans.qNum, selectedClass)}</td><td class="px-4 py-3 text-center font-bold ${ans.isCorrect ? 'text-blue-600' : 'text-red-600'}">${ans.isCorrect ? 'O' : 'X'}</td><td class="px-4 py-3 text-center">${data.studentData?.answerRates?.[i] ?? 'N/A'}%</td></tr>`).join('') : '<tr><td colspan="5">데이터 오류</td></tr>'} </tbody> </table> </div> </div>
            </div>
            <div class="report-page" data-page-name="오답 분석 및 대응 방안">
                 <div class="text-center my-4"> <h2 class="text-2xl font-bold">${selectedClass} ${selectedDate} 주간테스트 리포트</h2> </div>
                <div id="pdf-section-solutions" class="card p-8 printable-section"> <h3 class="section-title">🔍 오답 분석 및 대응 방안 (AI 기반)</h3> <div class="overflow-x-auto"> <table class="w-full text-sm text-left text-gray-500"> <thead class="text-xs text-gray-700 uppercase bg-gray-50"> <tr> <th class="px-4 py-3 text-center">문항번호</th><th class="px-6 py-3">세부 개념 유형 (AI 분석)</th><th class="px-4 py-3 text-center">난이도</th><th class="px-6 py-3">분석 포인트 (AI 분석)</th><th class="px-6 py-3">대응 방안 (AI 추천)</th> </tr> </thead> <tbody> ${incorrectAnalysisRows} </tbody> </table> </div> </div>
            </div>
        </div>
        {/* 페이지네이션은 JSX에서 직접 렌더링하도록 수정 */}
        <div id="pagination-controls" className="flex justify-center items-center space-x-4 mt-4" style={{ display: 'none' }}>
            <button id="prevPageBtn" className="btn btn-secondary">&lt; 이전</button>
            <span id="pageIndicator">1 / 3</span>
            <button id="nextPageBtn" className="btn btn-secondary">다음 &gt;</button>
        </div>
    `;
}

export function renderScoreChart(ctx, studentData, currentStudent) {
    if (!ctx || !studentData || !studentData.students) {
        console.error("renderScoreChart: Invalid arguments provided.");
        return null;
    }
    const submittedStudents = studentData.students.filter(s => s.submitted && typeof s.score === 'number');
    if (submittedStudents.length === 0) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "16px 'Noto Sans KR', sans-serif";
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'center';
        ctx.fillText('차트를 표시할 데이터가 없습니다.', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return null;
    }
    const sortedStudents = submittedStudents.slice().sort((a, b) => b.score - a.score);
    const labels = sortedStudents.map((s, index) => (currentStudent && s.name === currentStudent.name) ? s.name : `학생 ${index + 1}`);
    const scores = sortedStudents.map(s => s.score);
    const backgroundColors = sortedStudents.map(s =>
        (currentStudent && s.name === currentStudent.name) ? 'rgba(59, 130, 246, 0.7)' : 'rgba(156, 163, 175, 0.5)'
    );
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '학생별 점수',
                data: scores,
                backgroundColor: backgroundColors,
                borderWidth: 1,
                order: 2
            }, {
                label: '반 평균',
                data: Array(scores.length).fill(studentData.classAverage),
                type: 'line',
                fill: false,
                borderColor: 'rgb(239, 68, 68)',
                tension: 0.1,
                order: 1
            }]
        },
         options: {
            scales: { y: { beginAtZero: true, max: 100 } },
            plugins: {
                title: { display: true, text: '반 전체 점수 분포 (제출자)', font: { size: 16, family: "'Noto Sans KR', sans-serif" } },
                legend: { position: 'bottom', labels: { font: { family: "'Noto Sans KR', sans-serif" } } },
                 tooltip: { bodyFont: { family: "'Noto Sans KR', sans-serif" }, titleFont: { family: "'Noto Sans KR', sans-serif" } }
            }
        }
    });
}