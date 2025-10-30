// --- AI API 호출 (Placeholder) ---
// TODO: 여기에 실제 Gemini API 키와 호출 로직을 구현해야 합니다.
async function callGeminiAPI(prompt) {
    console.warn("callGeminiAPI - 실제 API 호출이 필요합니다. 임시 데이터를 반환합니다.");
    
    // 학생 분석 요청에 대한 가짜 응답
    if (prompt.includes("학생 정보:")) {
        return Promise.resolve(JSON.stringify({
            "strengths": "AI 분석: 점수가 반 평균보다 높고, 기본 연산 문제에서 강점을 보입니다.",
            "weaknesses": "AI 분석: 도형의 방정식과 관련된 고난도 문항에서 약점을 보입니다.",
            "recommendations": "AI 분석: 1. 원과 직선의 위치 관계 복습. 2. 다양한 도형 이동 문제 풀이.",
            "incorrect_analysis": [
                { "qNum": 18, "unit": "원의 방정식", "analysis_point": "원의 접선 개념 적용 미숙", "solution": "원의 접선 공식 암기 및 관련 유형 문제 풀이" },
                { "qNum": 20, "unit": "도형의 이동", "analysis_point": "복합적인 대칭 이동 순서 오류", "solution": "점과 도형의 대칭 이동 기본 개념을 명확히 구분하여 적용하는 연습 필요" }
            ]
        }));
    }
    // 반 전체 분석 요청에 대한 가짜 응답
     if (prompt.includes("반 전체 데이터:")) {
        return Promise.resolve(JSON.stringify({
             "summary": "AI 분석: 반 평균이 다소 낮아, 전반적인 개념 복습이 필요해 보입니다.",
             "common_weaknesses": "AI 분석: '원의 방정식'과 '도형의 이동' 파트에서 공통적인 약점이 발견되었습니다.",
             "recommendations": "AI 분석: 1. 오답률이 높은 문항의 핵심 개념 수업 시간에 재설명. 2. 관련 유제 풀이 과제 부과.",
             "question_analysis": [
                 { "qNum": 18, "unit": "원의 방정식", "analysis_point": "복잡한 조건의 해석 능력 부족", "solution": "문제의 조건을 시각화(그림)하는 연습이 필요합니다." },
                 { "qNum": 20, "unit": "도형의 이동", "analysis_point": "여러 개념이 복합된 고난도 문항", "solution": "평행이동과 대칭이동의 기본 원리를 명확히 설명하고, 이를 결합하는 문제를 단계별로 풀이합니다." }
             ]
         }));
     }
     // 단원 매핑 요청에 대한 가짜 응답
      if (prompt.includes("RPM 교재 목차:")) {
         const qCount = 20; // 임시 문항 수
         const units = [];
         for(let i=1; i<=qCount; i++) {
             units.push({ qNum: i, unit: `AI 분석 단원 (문항 ${i})`});
         }
         return Promise.resolve(JSON.stringify({ "question_units": units }));
      }

      return Promise.reject("알 수 없는 AI 프롬프트입니다.");
}

function parseAIResponse(response) {
    const match = response.match(/```json([\s\S]*?)```/);
    if (match) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.error("Failed to parse JSON from AI markdown block:", e);
            throw new Error("AI 응답 JSON 파싱에 실패했습니다.");
        }
    }
    try {
        return JSON.parse(response);
    } catch (e) {
        console.error("Failed to parse direct AI response as JSON:", e);
        if(response.includes("error")) {
             throw new Error("AI API 호출 중 오류가 발생했습니다. (API 키 또는 할당량 확인 필요)");
        }
        throw new Error("AI가 유효하지 않은 형식으로 응답했습니다.");
    }
}

// AI 프롬프트에 사용되는 헬퍼 함수
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

// --- AI 분석 함수들 (export) ---

export async function getAIAnalysis(student, data, selectedClass) {
    const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
    if (incorrectAnswers.length === 0) {
        return Promise.resolve({
            strengths: `총점 ${student.score}점으로, 모든 문제를 맞혔습니다. 이는 반 평균(${data.studentData.classAverage}점)보다 월등히 높은 점수이며, 시험 범위에 대한 개념을 완벽하게 숙지하고 있음을 보여줍니다. 특히 고난도 문항까지 실수 없이 해결한 점이 인상적입니다.`,
            weaknesses: "특별한 약점이 발견되지 않았습니다. 현재의 학습 페이스를 유지하며 심화 문제에 도전하는 것을 추천합니다.",
            recommendations: "지금처럼 꾸준히 학습하며, 다양한 유형의 심화 문제와 경시 대회 문제 등을 통해 문제 해결 능력을 더욱 향상시키는 것이 좋습니다. 또한, 새로운 개념을 학습할 때에도 현재와 같은 깊이 있는 탐구 자세를 유지하시기 바랍니다.",
            incorrect_analysis: []
        });
    }

    const incorrectInfoForAI = incorrectAnswers.map(ans => ({
        qNum: ans.qNum,
        difficulty: getDifficulty(ans.qNum, selectedClass) // selectedClass 전달
    }));

    const prompt = `
        다음은 한 학생의 수학 시험 결과와 시험지 텍스트입니다. 학생의 전반적인 강점, 약점, 학습 추천 방안과 함께, 틀린 각 문항에 대한 분석을 제공해주세요. 모든 내용은 한국어로, 전문적이고 격려하는 톤으로 작성해주세요. **분석 내용에는 '학생'이라는 단어나 특정 이름을 언급하지 말고, 주어를 생략하여 서술해주세요.**

        **학생 정보:**
        - 점수: ${student.score}점
        - 반 평균 점수: ${data.studentData.classAverage}점

        **시험지 전체 텍스트 (PDF 내용):**
        ${data.pdfInfo.fullText.substring(0, 8000)} 
        
        **틀린 문항 정보 (JSON):**
        ${JSON.stringify(incorrectInfoForAI, null, 2)}

        **분석 요청:**
        1.  **strengths:** 점수와 반 평균을 비교하고, 맞힌 문제들을 바탕으로 강점을 분석해주세요. (문자열)
        2.  **weaknesses:** 틀린 문항들의 공통점(핵심 개념 유형, 난이도 등)을 파악하여 주된 약점을 분석해주세요. (문자열)
        3.  **recommendations:** 분석된 약점을 보완하기 위한 구체적이고 실천 가능한 학습 계획이나 방법을 2~3가지 제안해주세요. (문자열)
        4.  **incorrect_analysis:** 틀린 각 문항에 대해 다음 항목을 포함하는 객체의 배열을 만들어주세요.
            -    **qNum:** 문항 번호 (숫자)
            -    **unit:** 위 **시험지 전체 텍스트**를 참고하여, 해당 문항이 다루는 가장 **세부적인 핵심 수학 개념**을 찾아 적어주세요. (예: '두 점 사이의 거리', '선분의 내분점', '삼각형의 무게중심') (문자열)
            -    **analysis_point:** 해당 문항을 틀린 핵심 원인을 **키워드 중심으로 매우 간결하게** 분석해주세요. (예: "좌/우극한 개념 혼동") (문자열)
            -    **solution:** 해당 약점을 보완하기 위한 실천 가능한 대응 방안을 **핵심만 요약하여 한 문장으로** 작성해주세요. (예: "다양한 불연속 함수 그래프에서 좌/우극한 구분 연습") (문자열)
            
        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        \`\`\`json
        {
            "strengths": "분석된 강점 내용",
            "weaknesses": "분석된 약점 내용",
            "recommendations": "학습 추천 내용",
            "incorrect_analysis": [
                {
                    "qNum": 12,
                    "unit": "삼각형의 무게중심",
                    "analysis_point": "무게중심 공식 적용 오류",
                    "solution": "세 꼭짓점의 좌표를 이용한 무게중심 공식 암기 및 반복 풀이"
                }
            ]
        }
        \`\`\`
    `;

    return callGeminiAPI(prompt).then(parseAIResponse);
}

export async function getOverallAIAnalysis(data) {
    const highErrorRateQuestions = [];
    data.studentData.answerRates.forEach((rate, i) => {
        if (rate <= 40) { // 오답률 60% 이상인 문항
            highErrorRateQuestions.push({ qNum: i + 1, rate: 100 - rate });
        }
    });
    highErrorRateQuestions.sort((a,b) => b.rate - a.rate);
    
    if (highErrorRateQuestions.length === 0) {
         return Promise.resolve({
             summary: "반 전체적으로 우수한 성취도를 보였습니다. 대부분의 학생들이 시험의 핵심 개념을 잘 이해하고 있으며, 오답률이 높은 문항이 발견되지 않았습니다.",
             common_weaknesses: "특별히 공통적으로 나타나는 약점은 없습니다. 학생 개개인의 오답 노트를 확인하여 세부적인 약점을 보완하는 개별화된 학습 전략이 유효합니다.",
             recommendations: "현재 학습 수준을 유지하며, 심화 문제 풀이 및 다양한 유형의 문제 해결을 통해 응용력을 기르는 것을 추천합니다. 학생들 간의 스터디 그룹을 활성화하여 서로의 풀이법을 공유하는 것도 좋은 방법입니다.",
             question_analysis: []
         });
    }

    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학급의 수학 시험 결과 데이터와 시험지 텍스트입니다. 이 데이터를 바탕으로 반 전체의 학습 상황을 분석하고, 교사를 위한 구체적인 피드백을 제공해주세요. 모든 내용은 한국어로, 전문적이고 명료한 톤으로 작성해주세요.

        **반 전체 데이터:**
        - 반 평균 점수: ${data.studentData.classAverage}점
        - 총 문항 수: ${data.studentData.questionCount}개
        
        **시험지 전체 텍스트 (PDF 내용):**
        ${data.pdfInfo.fullText.substring(0, 8000)}
        
        **주요 오답 문항 정보 (정답률 40% 이하):**
        ${JSON.stringify(highErrorRateQuestions, null, 2)}

        **분석 요청:**
        1.  **summary:** 반 평균 점수와 주요 오답 문항을 바탕으로 반 전체의 학업 성취도와 학습 경향에 대한 **종합적인 총평**을 작성해주세요. (문자열)
        2.  **common_weaknesses:** 위 **주요 오답 문항 정보**와 **시험지 전체 텍스트**를 종합적으로 분석하여, 학생들이 공통적으로 어려움을 겪는 **핵심 개념이나 문제 유형**을 2~3가지 구체적으로 짚어주세요. (문자열)
        3.  **recommendations:** 분석된 공통 약점을 보완하고 반 전체의 성취도를 향상시키기 위해 교사가 다음 수업 시간에 적용할 수 있는 **구체적인 지도 방안이나 활동**을 2~3가지 제안해주세요. (문자열)
        4.  **question_analysis:** 위 **주요 오답 문항 정보**에 있는 모든 문항 각각에 대해 다음 항목을 포함하는 객체의 배열을 만들어주세요.
            -    **qNum:** 문항 번호 (숫자)
            -    **unit:** **시험지 전체 텍스트**를 참고하여 해당 문항이 다루는 가장 **세부적인 핵심 수학 개념**을 찾아 적어주세요. (예: '두 점 사이의 거리', '선분의 내분점') (문자열)
            -    **analysis_point:** 해당 문항의 오답률이 높은 핵심 원인을 **교육학적 관점에서 간결하게** 분석해주세요. (예: "그래프 개형 추론 능력 부족") (문자열)
            -    **solution:** 이 문제를 해결하기 위해 학생들에게 **강조해야 할 핵심 개념이나 풀이 전략**을 한 문장으로 요약해주세요. (예: "도함수를 활용하여 함수의 증가와 감소를 표로 나타내는 연습 강화") (문자열)
            
        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
         \`\`\`json
        {
            "summary": "종합 총평 내용",
            "common_weaknesses": "공통 약점 분석 내용",
            "recommendations": "수업 지도 방안 추천 내용",
            "question_analysis": [
                {
                    "qNum": 18,
                    "unit": "미분계수와 도함수",
                    "analysis_point": "복잡한 조건의 해석 및 종합적 사고력 요구",
                    "solution": "문제의 각 조건을 분리하여 해석하고, 이를 그래프와 수식으로 연결하는 훈련이 필요합니다."
                }
            ]
        }
         \`\`\`
    `;
    
    return callGeminiAPI(prompt).then(parseAIResponse);
}

export async function getQuestionUnitMapping(data) {
    const rpmToc = `
        01 평면좌표: 두 점 사이의 거리, 선분의 내분점과 외분점, 삼각형의 무게중심
        02 직선의 방정식: 직선의 방정식, 두 직선의 교점을 지나는 직선, 두 직선의 위치 관계, 점과 직선 사이의 거리
        03 원의 방정식: 원의 방정식, 원과 직선의 위치 관계, 원의 접선, 두 원의 교점을 지나는 직선과 원
        04 도형의 이동: 평행이동, 대칭이동
        05 집합의 뜻과 포함 관계
        06 집합의 연산
        07 명제: 명제와 조건, 명제의 증명, 절대부등식
        08 함수: 함수, 여러 가지 함수, 합성함수, 역함수
        09 유리함수
        10 무리함수
    `;
    const prompt = `
        다음은 시험지 전체 텍스트와 관련 교재의 목차입니다. 1번부터 ${data.studentData.questionCount}번까지 각 문항이 다루는 가장 **세부적인 핵심 수학 개념**을 분석해주세요.

        **시험지 전체 텍스트 (PDF 내용):**
        ${data.pdfInfo.fullText.substring(0, 15000)}
        
        **RPM 교재 목차:**
        ${rpmToc}

        **분석 요청:**
        각 문항에 대해, 시험지 내용과 위 교재 목차를 참고하여 가장 **세부적인 핵심 수학 개념**을 찾아 JSON 형식으로 반환해주세요. (예: '두 점 사이의 거리', '선분의 내분점', '합성함수', '역함수')

        결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요.
         \`\`\`json
        {
            "question_units": [
                { "qNum": 1, "unit": "두 점 사이의 거리" },
                { "qNum": 2, "unit": "선분의 내분점" },
                { "qNum": ${data.studentData.questionCount}, "unit": "..." }
            ]
        }
         \`\`\`
    `; 
    return callGeminiAPI(prompt).then(parseAIResponse);
}