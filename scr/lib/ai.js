// --- AI API 호출 (Placeholder) ---
// TODO: 이 파일은 현재 실제 Gemini API를 호출하지 않고,
// 제공해주신 예시 PDF의 데이터를 임시로 반환합니다.
async function callGeminiAPI(prompt) {
    // ⭐️ [수정] console.warn을 console.log로 변경
    console.log("callGeminiAPI (stub 모드):", prompt.substring(0, 100) + "...");
    
    // ⭐️ 학생 개별 분석 요청 (김주원 학생 데이터)
    if (prompt.includes("학생 정보:")) {
        return Promise.resolve(JSON.stringify({
            "strengths": "취득 점수가 반 평균 점수(58점)보다 높은 60점을 기록하여 해당 단원의 기본적인 개념 이해도는 양호한 수준으로 판단됩니다. 특히, 도함수의 정의를 활용한 함수의 증가/감소, 극대/극소 판별, 그리고 간단한 속도와 가속도 문제 등 기본 및 중간 난이도의 핵심 문항들을 성공적으로 해결했습니다. 이는 꾸준한 학습 태도와 계산 숙련도가 뒷받침되었음을 의미합니다.",
            "weaknesses": "주된 약점은 '도함수의 활용' 단원의 심화 영역, 특히 방정식 및 부등식에의 활용(Q17, Q19)과 최대/최소 모델링 문제(Q14)에서 나타났습니다. 어려운 난이도의 문제뿐만 아니라, 극값을 갖기 위한 조건이나 함수의 증가/감소와 관련된 기본 정의 문제 (Q3, Q11)에서도 오답이 발생하여, 개념을 정확히 이해하고 대입하는 과정에서의 미세한 오류나 정의의 혼동이 약점으로 작용하고 있습니다. 특히, 모름으로 제출된 문항(Q11, Q14)은 문제 해결의 시작점조차 파악하지 못했거나 복합적인 개념 적용에 어려움을 겪었음을 시사합니다.",
            "recommendations": "첫째, 도함수의 그래프(f'(x))와 원함수의 개형(f(x)) 사이의 관계를 시각적으로 분석하고 해석하는 연습을 강화하여 복합적인 그래프 해석 능력을 향상시킬 필요가 있습니다.\n둘째, '함수의 최대/최소 활용' 및 '방정식/부등식에의 활용' 유형에 초점을 맞추어, 문제를 함수 모델링 형태로 변환하고 최소값 혹은 극값 조건을 적용하는 심화 유형 훈련에 집중해야 합니다.\n셋째, 틀린 문항 중 쉬운 난이도(Q3)나 개념 정의 관련 문항에 대해 정확한 정의(예: 증가 함수의 조건 f'(x) ≥ 0)를 재확인하고, 이를 문제 풀이에 정확히 적용하는 습관을 들여 사소한 실수를 방지해야 합니다.",
            "incorrect_analysis": [
                { "qNum": 3, "unit": "함수의 증가와 감소의 정의", "analysis_point": "함수 증가 (f'(x)≥0)의 등호 포함 여부 혼동 또는 단순 계산 오류", "solution": "함수의 증가/감소 정의에 대한 등호 포함 조건과 미분 계수 계산의 정확성 확보" },
                { "qNum": 9, "unit": "함수의 증가/감소의 판정", "analysis_point": "주어진 구간에서 함수가 증가하기 위한 미정계수 결정 조건 적용 미흡", "solution": "도함수의 그래프가 주어진 구간에서 항상 양수(0 이상)가 될 조건을 정확히 파악하는 연습" },
                { "qNum": 11, "unit": "극대와 극소의 응용 (미정계수)", "analysis_point": "함수가 극값을 갖지 않을 조건 (f'(x)=0의 실근 조건) 파악 실패", "solution": "극값을 가질 조건과 갖지 않을 조건에 대한 판별식(D≤0) 활용 문제 집중 풀이" },
                { "qNum": 12, "unit": "도함수의 그래프 해석", "analysis_point": "도함수 그래프(f'(x))를 이용한 원함수 개형(f(x))의 극값 및 변곡점 위치 해석 오류", "solution": "f'(x)의 부호 변화를 기준으로 f(x)의 증가, 감소, 극값을 연결하는 훈련 강화" },
                { "qNum": 14, "unit": "최대/최소의 활용 (응용 문제)", "analysis_point": "실생활 문제에서 최대/최소를 구하기 위한 함수식 설정(모델링) 능력 부족", "solution": "활용 문제에서 변수를 설정하고 주어진 조건을 활용하여 함수식을 유도하는 과정 반복 훈련" },
                { "qNum": 16, "unit": "속도와 가속도 (이동 거리)", "analysis_point": "위치 변화량과 실제로 움직인 총 거리 계산 개념 혼동", "solution": "총 이동 거리를 구하는 과정에서 속력(|v(t)|)을 적분해야 함을 명확히 이해하고, 속도 그래프의 부호 변화 지점 분석 연습" },
                { "qNum": 17, "unit": "방정식에의 활용 (실근의 개수)", "analysis_point": "방정식을 f(x) = k 형태로 변형한 후, 상수 함수와 원함수 그래프의 교점 개수 분석 미흡", "solution": "함수의 개형을 정확히 그린 후, 극대/극소 값을 기준으로 상수 k 값에 따른 실근의 개수 변화를 분석하는 연습" },
                { "qNum": 19, "unit": "부등식에의 활용", "analysis_point": "부등식이 항상 성립하기 위한 조건(함수의 최소값 조건) 적용 오류", "solution": "부등식의 성립 조건을 해당 구간에서 함수의 최소값 또는 최대값 조건으로 변환하여 해결하는 훈련 강화" }
            ]
        }));
    }
    // ⭐️ 반 전체 분석 요청 (PDF 1페이지 데이터)
     if (prompt.includes("반 전체 데이터:")) {
        return Promise.resolve(JSON.stringify({
             "summary": "반 평균 58점, 최고 65점, 최저 40점으로, 일부 고난도 문항에서 오답률이 높게 나타났습니다. 전반적으로 기본 개념은 숙지하고 있으나, 심화 개념 적용 및 복합 문제 해결에 어려움을 겪는 것으로 보입니다.",
             "common_weaknesses": "도함수의 활용(그래프 개형 추론, 최대/최소 활용), 방정식 및 부등식에의 활용, 그리고 속도/가속도 개념에서 공통적인 약점이 발견되었습니다.",
             "recommendations": "1. 오답률이 높은 문항(1, 10, 11, 14, 16, 18, 20번)을 중심으로 핵심 개념을 재설명합니다. 2. 함수의 개형을 그리는 연습을 강화하고, 이를 방정식/부등식 문제에 적용하는 훈련이 필요합니다. 3. 실생활 활용 문제(모델링)에 대한 접근법을 단계별로 지도합니다.",
             "question_analysis": [
                 { "qNum": 1, "unit": "함수의 증가와 감소 판정", "analysis_point": "도함수의 부호와 함수의 증가/감소 사이의 관계에 대한 기초 개념 적용의 정확성 부족", "solution": "f'(x)의 부호가 양수/음수인 구간과 f(x)의 증가/감소 구간을 연결하는 기본 문제 반복 풀이" },
                 { "qNum": 10, "unit": "삼차함수 그래프의 특징", "analysis_point": "함수의 개형을 활용하여 실근의 개수를 시각적으로 추론하는 능력 부족", "solution": "상수항을 분리하여 f(x)=k 꼴로 만든 후, f(x)의 그래프와 직선 y=k의 교점을 이용하는 방법 지도" },
                 { "qNum": 11, "unit": "극대와 극소의 응용", "analysis_point": "주어진 닫힌 구간에서 극값과 경계값을 비교하는 과정에 대한 명확한 이해 부족", "solution": "최대/최소 정리를 복습하고, 구간의 양 끝값과 극값을 모두 비교하는 연습" },
                 { "qNum": 14, "unit": "최대/최소의 활용", "analysis_point": "미분을 이용하여 부등식이 항상 성립할 조건을 찾는 논리적 과정의 미흡", "solution": "함수로 변환 후, (최소값) >= 0 임을 보이는 문제 풀이 전략 강화" },
                 { "qNum": 16, "unit": "속도와 가속도", "analysis_point": "시간에 따른 위치, 속도, 가속도의 개념적 정의 및 미분 관계 연결 오류", "solution": "위치, 속도, 가속도 간의 미분/적분 관계를 명확히 재정립" },
                 { "qNum": 18, "unit": "미분을 이용한 활용 문제", "analysis_point": "여러 가지 조건을 동시에 만족시키는 함수의 개형을 역으로 추론하는 종합적 사고력 요구", "solution": "조건을 하나씩 만족하는 그래프를 그려보고, 조합하여 최종 개형을 찾는 연습" },
                 { "qNum": 20, "unit": "방정식/부등식 활용", "analysis_point": "실생활 또는 기하학적 문제를 미분 가능한 함수로 변환하는 수학적 모델링 능력 부족", "solution": "도형의 넓이/부피 등을 변수 t에 대한 함수로 표현하는 모델링 훈련" }
             ]
         }));
     }
     // ⭐️ 단원 매핑 요청 (PDF 3페이지 데이터)
      if (prompt.includes("RPM 교재 목차:")) {
         return Promise.resolve(JSON.stringify({ "question_units": [
                { "qNum": 1, "unit": "함수의 증가와 감소 판정" },
                { "qNum": 2, "unit": "함수의 증가 상태와 미분 계수" },
                { "qNum": 3, "unit": "함수의 증가와 감소의 정의" },
                { "qNum": 4, "unit": "극댓값과 극솟값 구하기" },
                { "qNum": 5, "unit": "도함수를 이용한 함수의 그래프 개형 파악" },
                { "qNum": 6, "unit": "함수의 증가/감소 구간 찾기" },
                { "qNum": 7, "unit": "극대, 극소의 정의 및 성질" },
                { "qNum": 8, "unit": "닫힌 구간에서의 함수의 최대 최소 정리" },
                { "qNum": 9, "unit": "함수의 증가/감소의 판정" },
                { "qNum": 10, "unit": "삼차함수 그래프의 특징 및 극값 조건" },
                { "qNum": 11, "unit": "극대와 극소의 응용 (미정계수)" },
                { "qNum": 12, "unit": "도함수의 그래프 해석" },
                { "qNum": 13, "unit": "부등식의 증명 (함수의 최소값을 이용)" },
                { "qNum": 14, "unit": "최대/최소의 활용 (응용 문제)" },
                { "qNum": 15, "unit": "위치, 속도, 가속도의 개념 정의" },
                { "qNum": 16, "unit": "속도와 가속도 (이동 거리)" },
                { "qNum": 17, "unit": "방정식에의 활용 (실근의 개수)" },
                { "qNum": 18, "unit": "미분을 이용한 활용 문제 (최대/최소 응용)" },
                { "qNum": 19, "unit": "부등식에의 활용" },
                { "qNum": 20, "unit": "방정식/부등식 활용의 종합 문제" }
            ]}));
      }

      return Promise.reject("알 수 없는 AI 프롬프트입니다.");
}

function parseAIResponse(response) {
    // ⭐️ AI 응답이 마크다운 JSON 블록을 포함하고 있는지 확인
    const match = response.match(/```json([\s\S]*?)```/);
    if (match) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            console.error("Failed to parse JSON from AI markdown block:", e);
            throw new Error("AI 응답 JSON 파싱에 실패했습니다.");
        }
    }
    // ⭐️ 마크다운 블록이 없다면, 응답 전체가 JSON이라고 가정
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
    // ⭐️ PDF 예시의 난이도 체계를 단순화하여 적용
    if (selectedClass.includes('고2') || selectedClass.includes('고1')) {
        if (qNum >= 14) return '어려움';
        if (qNum >= 6) return '보통';
        return '쉬움';
    } else {
        if (qNum >= 18) return '어려움';
        if (qNum >= 9) return '보통';
        return '쉬움';
    }
}

// --- AI 분석 함수들 (export) ---

export async function getAIAnalysis(student, data, selectedClass) {
    const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
    // ⭐️ PDF 예시(김주원)는 9개 오답이 있으므로 0개일 때의 분기(만점)는 유지
    if (incorrectAnswers.length === 0) {
        return Promise.resolve({
            "strengths": `총점 ${student.score}점으로, 모든 문제를 맞혔습니다. 이는 반 평균(${data.studentData.classAverage}점)보다 월등히 높은 점수이며, 시험 범위에 대한 개념을 완벽하게 숙지하고 있음을 보여줍니다. 특히 고난도 문항까지 실수 없이 해결한 점이 인상적입니다.`,
            "weaknesses": "특별한 약점이 발견되지 않았습니다. 현재의 학습 페이스를 유지하며 심화 문제에 도전하는 것을 추천합니다.",
            "recommendations": "지금처럼 꾸준히 학습하며, 다양한 유형의 심화 문제와 경시 대회 문제 등을 통해 문제 해결 능력을 더욱 향상시키는 것이 좋습니다. 또한, 새로운 개념을 학습할 때에도 현재와 같은 깊이 있는 탐구 자세를 유지하시기 바랍니다.",
            "incorrect_analysis": []
        });
    }

    const incorrectInfoForAI = incorrectAnswers.map(ans => ({
        qNum: ans.qNum,
        difficulty: getDifficulty(ans.qNum, selectedClass)
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
    
    // ⭐️ PDF 예시는 오답률 높은 문항이 있으므로 0개일 때의 분기(만점)는 유지
    if (highErrorRateQuestions.length === 0) {
         return Promise.resolve({
             "summary": "반 전체적으로 우수한 성취도를 보였습니다. 대부분의 학생들이 시험의 핵심 개념을 잘 이해하고 있으며, 오답률이 높은 문항이 발견되지 않았습니다.",
             "common_weaknesses": "특별히 공통적으로 나타나는 약점은 없습니다. 학생 개개인의 오답 노트를 확인하여 세부적인 약점을 보완하는 개별화된 학습 전략이 유효합니다.",
             "recommendations": "현재 학습 수준을 유지하며, 심화 문제 풀이 및 다양한 유형의 문제 해결을 통해 응용력을 기르는 것을 추천합니다. 학생들 간의 스터디 그룹을 활성화하여 서로의 풀이법을 공유하는 것도 좋은 방법입니다.",
             "question_analysis": []
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
        11 도함수의 활용: 함수의 증가와 감소, 극대와 극소, 최대/최소, 방정식/부등식 활용, 속도/가속도
    `; // ⭐️ 도함수의 활용 추가
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