// scr/lib/ai.js 파일 내용

// ⭐️ 1. Firebase Functions 모듈 임포트
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebaseConfig'; // ⭐️ firebaseConfig.js에서 db를 가져옵니다.

// ⭐️ 2. API 키와 모델 변수 (GEMINI_API_KEY, GEMINI_MODEL) 완전 제거!

// ⭐️ 3. 우리가 만든 Cloud Function을 참조
const functions = getFunctions(db.app); // ⭐️ db가 속한 app 인스턴스를 사용
const callGeminiAPIFunction = httpsCallable(functions, 'callGeminiAPI');


function parseAIResponse(response) {
    // (이 함수는 기존과 동일)
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

// ⭐️ 4. 실제 API 호출 함수 (Cloud Function을 호출하도록 수정됨)
async function callGeminiAPI(prompt) {
    
    console.log(`[Cloud Function Call] Model: (gemini-via-backend), Prompt length: ${prompt.length} chars`);
    
    try {
        // ⭐️ 5. Firebase Function을 호출
        const result = await callGeminiAPIFunction({ prompt: prompt });
        
        // ⭐️ 6. [버그 수정] Cloud Function 응답 형식 처리 (Robust-Fix)
        const responseData = result.data;
        let responseText;

        if (typeof responseData === 'string') {
            // Case 1: Backend가 예상대로 '문자열'을 반환한 경우
            responseText = responseData;
        } else if (responseData && typeof responseData.result === 'string') {
            // Case 2: Backend가 {result: '...'} 객체를 반환한 경우 (에러 로그에서 확인됨)
            responseText = responseData.result;
        } else {
            // Case 3: 그 외의 모든 유효하지 않은 응답
            console.error("Cloud Function에서 유효하지 않은 응답을 받았습니다:", responseData);
            throw new Error("AI(Cloud Function)로부터 유효한 응답 텍스트를 받지 못했습니다.");
        }
        
        // ⭐️ 7. 응답 텍스트를 파싱 함수에 넘김 (기존과 동일)
        return parseAIResponse(responseText); 

    } catch (error) {
        console.error("Firebase Function 호출 오류:", error);
        // ⭐️ [수정] 오류 메시지가 undefined로 표시되는 문제 수정
        const errorMessage = error.message || "알 수 없는 오류";
        const errorCode = error.code || "internal";
        throw new Error(`AI 분석(Cloud Function) 호출 실패: ${errorCode} - ${errorMessage}`);
    }
}

// -------------------------------------------------------------------
// (getDifficulty, getAIAnalysis, getOverallAIAnalysis, getQuestionUnitMapping 함수는
//  수정할 필요 없이 기존과 100% 동일합니다.)
// -------------------------------------------------------------------

// (헬퍼 함수 - 변경 없음)
function getDifficulty(qNum, selectedClass) {
    if (!selectedClass) return '정보 없음';
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

// (학생 개별 분석 - 변경 없음)
export async function getAIAnalysis(student, data, selectedClass, questionUnitMap) {
    const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
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
    
    if (!questionUnitMap || !questionUnitMap.question_units) {
        throw new Error("학생 분석을 위한 '문항 단원 맵' 데이터가 없습니다. 파일 업로드 시 AI 분석이 실패했을 수 있습니다.");
    }

    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학생의 수학 시험 결과와 문항별 개념 맵입니다. 학생의 전반적인 강점, 약점, 학습 추천 방안과 함께, 틀린 각 문항에 대한 분석을 제공해주세요. 모든 내용은 한국어로, 전문적이고 격려하는 톤으로 작성해주세요. 분석 내용에는 '학생'이라는 단어나 특정 이름을 언급하지 말고, 주어를 생략하여 서술하세요.

        **학생 정보:**
        - 점수: ${student.score}점
        - 반 평균 점수: ${data.studentData.classAverage}점

        **시험 문항별 개념 (미리 분석됨):**
        ${JSON.stringify(questionUnitMap, null, 2)}

        **틀린 문항 정보 (JSON):**
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
    
    // (내부에서 callGeminiAPI(prompt)를 호출하지만, 그 함수가 바뀌었으므로 안전)
    return callGeminiAPI(prompt);
}

// (반 전체 분석 - 변경 없음)
export async function getOverallAIAnalysis(data) {
    const highErrorRateQuestions = [];
    data.studentData.answerRates.forEach((rate, i) => {
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
        - 반 평균 점수: ${data.studentData.classAverage}점
        - 총 문항 수: ${data.studentData.questionCount}개
        
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

// (단원 매핑 - 변경 없음)
export async function getQuestionUnitMapping(data) {
    const prompt = `
        다음은 시험지 전체 텍스트입니다. 1번부터 ${data.studentData.questionCount}번까지 각 문항이 다루는 가장 **세부적이고 정확한 핵심 수학 개념**을 시험지 텍스트(문제 내용, 표지의 단원 정보 등)를 분석하여 찾아주세요.

        **시험지 전체 텍스트 (PDF 내용):**
        ${data.pdfInfo.fullText.substring(0, 15000)}

        **분석 요청:**
        각 문항에 대해, 시험지 내용을 면밀히 분석하여 가장 **세부적이고 정확한 핵심 수학 개념**을 JSON 형식으로 반환해주세요. (예: '두 점 사이의 거리', '선분의 내분점', '유리함수의 평행이동', '집합의 뜻과 표현')

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "question_units": [
                { "qNum": 1, "unit": "집합의 뜻과 표현" },
                { "qNum": 2, "unit": "실수의 분류" },
                { "qNum": ${data.studentData.questionCount}, "unit": "..." }
            ]
        }
    `; 
    return callGeminiAPI(prompt);
}