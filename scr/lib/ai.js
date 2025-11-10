// scr/lib/ai.js 파일 내용

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebaseConfig'; 

const functions = getFunctions(db.app); 
const callGeminiAPIFunction = httpsCallable(functions, 'callGeminiAPI');


function parseAIResponse(response) {
    try {
        return JSON.parse(response);
    } catch (e) {
        const match = response.match(/```json([\s\S]*?)```/);
        if (match) {
             try { 
                 return JSON.parse(match[1]); 
             } catch (e2) { 
                 console.error("Failed to parse JSON from AI markdown block:", e2); 
             }
        }
        console.error("Failed to parse direct AI response as JSON:", e);
        if(response.includes("error")) { 
            throw new Error("AI API 호출 중 오류가 발생했습니다. (백엔드 함수 확인 필요)"); 
        }
        throw new Error("AI가 유효하지 않은 형식으로 응답했습니다.");
    }
}

async function callGeminiAPI(prompt) {
    
    console.log(`[Cloud Function Call] Model: (gemini-via-backend), Prompt length: ${prompt.length} chars`);
    
    try {
        const result = await callGeminiAPIFunction({ prompt: prompt });
        
        const responseData = result.data;
        let responseText;

        if (typeof responseData === 'string') {
            responseText = responseData;
        } else if (responseData && typeof responseData.result === 'string') {
            responseText = responseData.result;
        } else {
            console.error("Cloud Function에서 유효하지 않은 응답을 받았습니다:", responseData);
            throw new Error("AI(Cloud Function)로부터 유효한 응답 텍스트를 받지 못했습니다.");
        }
        
        return parseAIResponse(responseText); 

    } catch (error) {
        console.error("Firebase Function 호출 오류:", error);
        const errorMessage = error.message || "알 수 없는 오류";
        const errorCode = error.code || "internal";
        throw new Error(`AI 분석(Cloud Function) 호출 실패: ${errorCode} - ${errorMessage}`);
    }
}

// -------------------------------------------------------------------
// ⭐️ [삭제] 하드코딩된 getDifficulty 함수 제거
// -------------------------------------------------------------------


// ⭐️ [수정] 학생 개별 분석 (하드코딩 난이도 제거)
export async function getAIAnalysis(student, data, selectedClass, questionUnitMap) {
    const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
    if (incorrectAnswers.length === 0) {
        return Promise.resolve({
            "strengths": `총점 ${student.score}점으로, 모든 문제를 맞혔습니다. 이는 반 평균(${data.classAverage}점)보다 월등히 높은 점수이며, 시험 범위에 대한 개념을 완벽하게 숙지하고 있음을 보여줍니다. 특히 고난도 문항까지 실수 없이 해결한 점이 인상적입니다.`,
            "weaknesses": "특별한 약점이 발견되지 않았습니다. 현재의 학습 페이스를 유지하며 심화 문제에 도전하는 것을 추천합니다.",
            "recommendations": "지금처럼 꾸준히 학습하며, 다양한 유형의 심화 문제와 경시 대회 문제 등을 통해 문제 해결 능력을 더욱 향상시키는 것이 좋습니다. 또한, 새로운 개념을 학습할 때에도 현재와 같은 깊이 있는 탐구 자세를 유지하시기 바랍니다.",
            "incorrect_analysis": []
        });
    }

    // ⭐️ [수정] AI가 분석한 난이도를 questionUnitMap에서 가져오도록 수정
    const unitMap = new Map();
    const difficultyMap = new Map();
    if (questionUnitMap && questionUnitMap.question_units) {
        questionUnitMap.question_units.forEach(item => {
            unitMap.set(item.qNum, item.unit);
            difficultyMap.set(item.qNum, item.difficulty);
        });
    } else {
         throw new Error("학생 분석을 위한 '문항 단원 맵' 데이터가 없습니다. 파일 업로드 시 AI 분석이 실패했을 수 있습니다.");
    }

    const incorrectInfoForAI = incorrectAnswers.map(ans => ({
        qNum: ans.qNum,
        // ⭐️ [수정] 하드코딩된 getDifficulty 대신 AI가 분석한 난이도를 사용
        difficulty: difficultyMap.get(ans.qNum) || '분석 안됨'
    }));
    

    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학생의 수학 시험 결과와 문항별 개념 맵입니다. 학생의 전반적인 강점, 약점, 학습 추천 방안과 함께, 틀린 각 문항에 대한 분석을 제공해주세요. 모든 내용은 한국어로, 전문적이고 격려하는 톤으로 작성해주세요. 분석 내용에는 '학생'이라는 단어나 특정 이름을 언급하지 말고, 주어를 생략하여 서술하세요.

        **학생 정보:**
        - 점수: ${student.score}점
        - 반 평균 점수: ${data.classAverage}점 

        **시험 문항별 개념 (미리 분석됨):**
        ${JSON.stringify(questionUnitMap, null, 2)}

        **틀린 문항 정보 (AI가 분석한 난이도 포함):**
        ${JSON.stringify(incorrectInfoForAI, null, 2)}
        
        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
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
    `;
    
    return callGeminiAPI(prompt);
}

// (반 전체 분석 - 변경 없음)
export async function getOverallAIAnalysis(data) {
    const highErrorRateQuestions = [];
    data.answerRates.forEach((rate, i) => {
        if (rate <= 40) { 
            highErrorRateQuestions.push({ qNum: i + 1, rate: 100 - rate });
        }
    });
    highErrorRateQuestions.sort((a,b) => b.rate - a.rate);
    
    if (highErrorRateQuestions.length === 0) {
         return Promise.resolve({
             "summary": "반 전체적으로 우수한 성취도를 보였습니다...",
             "common_weaknesses": "특별히 공통적으로 나타나는 약점은 없습니다...",
             "recommendations": "현재 학습 수준을 유지하며...",
             "question_analysis": []
         });
    }

    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학급의 수학 시험 결과 데이터와 시험지 텍스트입니다. 이 데이터를 바탕으로 반 전체의 학습 상황을 분석하고, 교사를 위한 구체적인 피드백을 제공해주세요. 모든 내용은 한국어로, 전문적이고 명료한 톤으로 작성해주세요.

        **반 전체 데이터:**
        - 반 평균 점수: ${data.classAverage}점 
        - 총 문항 수: ${data.questionCount}개 
        
        **시험지 전체 텍스트 (PDF 내용):**
        ${data.pdfInfo.fullText.substring(0, 8000)}
        
        **주요 오답 문항 정보 (정답률 40% 이하):**
        ${JSON.stringify(highErrorRateQuestions, null, 2)}

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
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
    `;
    
    return callGeminiAPI(prompt);
}

// ⭐️ [수정] 단원 매핑 (프롬프트 수정)
export async function getQuestionUnitMapping(data) {
    const prompt = `
        다음은 시험지 전체 텍스트입니다. 1번부터 ${data.questionCount}번까지 각 문항이 다루는 **(1)가장 세부적인 '문제 유형명'**과 **(2)난이도**를 분석하여 찾아주세요.

        **시험지 전체 텍스트 (PDF 내용):**
        ${data.pdfInfo.fullText.substring(0, 15000)}

        **분석 요청:**
        각 문항에 대해, RPM 수학 교재의 유형명처럼 **매우 세부적인 '유형명(unit)'**과 **'난이도(difficulty)'**를 JSON 형식으로 반환해주세요.
        
        [매우 중요]
        - 단순한 단원명('삼각비')을 절대 반환하지 마세요.
        - 난이도는 반드시 "A", "B-", "B0", "B+", "C" 5단계로 분류해주세요.
        - (A = 가장 쉬움, B0 = 보통, C = 가장 어려움)
        - '쉬움', '보통', '어려움'을 사용하지 마세요.
        
        [좋은 예시 - 유형명]
        - "유형 01: 두 점 사이의 거리"
        - "유형 05: 선분의 길이의 제곱의 합의 최솟값"
        - "유형 08: x, y축에 동시에 접하는 원의 방정식"
        - "유형 11: 삼각비의 값을 이용한 식의 계산"
        - "유형 15: 표준편차와 분산의 관계"

        [좋은 예시 - 난이도]
        - "A" (가장 쉬운 유형, 기본 문제)
        - "B0" (보통 유형, 대표 문제)
        - "C" (가장 어려운 유형, 킬러 문제)

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "question_units": [
                { "qNum": 1, "unit": "유형 01: 집합의 뜻과 표현", "difficulty": "A" },
                { "qNum": 2, "unit": "유형 03: 두 점 사이의 거리", "difficulty": "B-" },
                { "qNum": ${data.questionCount}, "unit": "...", "difficulty": "C" }
            ]
        }
    `; 
    return callGeminiAPI(prompt);
}