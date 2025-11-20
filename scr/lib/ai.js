// scr/lib/ai.js

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebaseConfig'; 

// 백엔드와 동일한 리전("asia-northeast3")으로 변경
const functions = getFunctions(db.app, "asia-northeast3"); 

// 클라이언트 타임아웃을 10분(600,000ms)으로 설정
const longTimeoutOptions = { timeout: 600000 }; 

// 10분 타임아웃 옵션을 적용하여 함수를 정의
const callGeminiAPIFunction = httpsCallable(functions, 'callGeminiAPI', longTimeoutOptions); // 2.5-flash (Text)용
const callGeminiProVisionFunction = httpsCallable(functions, 'callGeminiProVisionAPI', longTimeoutOptions); // 2.5-pro (Vision)용


// ⭐️ [최종 수정] AI 응답 파싱 함수 (모든 LaTeX 명령어 보존)
function parseAIResponse(response) {
    let jsonString = response.trim();
    
    // 1. AI가 마크다운 블록(```json ... ```)을 포함한 경우 제거
    const match = jsonString.match(/```json([\s\S]*?)```/);
    if (match && match[1]) {
        jsonString = match[1].trim();
    }
    
    // ⭐️ [핵심 수정] LaTeX 수식 보호 로직 (최종 강화판)
    // 설명: JSON 표준 이스케이프 문자 중 줄바꿈(\n)과 유니코드(\u)를 제외한 
    // 모든 백슬래시 패턴(\t, \r, \b, \f 등)을 강제로 문자로 변환합니다.
    // -> \text, \theta, \rho, \boxed, \frac 등 모든 수식 명령어 정상화
    jsonString = jsonString.replace(/\\([^"\\\/nu])/g, '\\\\$1');

    // 3. JSON 파싱 시도
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn("1차 JSON 파싱 실패. 재시도합니다:", e.message);
        try {
             // 재시도: 최후의 수단으로 모든 백슬래시를 이중으로 변경
             const aggressiveFix = jsonString.replace(/\\/g, '\\\\');
             return JSON.parse(aggressiveFix);
        } catch (e2) {
             console.error("최종 파싱 실패:", e2);
             console.error("문제가 된 JSON 문자열:", jsonString); 
             throw new Error("AI가 유효하지 않은 JSON 형식으로 응답했습니다. (수식 기호 문제)");
        }
    }
}

// AI 호출 함수 (재시도 로직 유지)
async function callAIFunction(fnToCall, payload, retries = 3) { 
    
    console.log(`[Cloud Function Call] Prompt length: ${payload.prompt.length} chars`);

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            const result = await fnToCall(payload);
            
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
            
            const parsedResponse = parseAIResponse(responseText);
            
            // 내용 검증
            if (parsedResponse.question_analysis && parsedResponse.question_analysis.some(u => (u.unit && u.unit.includes("분석")))) {
                 console.warn(`[Attempt ${attempt}] AI content failure: "유형 분석 필요" 감지.`);
                 if (attempt <= retries) throw new Error("AI가 유효한 유형명을 반환하지 못했습니다.");
            }

            return parsedResponse; 

        } catch (error) {
            const errorMessage = error.message || "알 수 없는 오류";
            const isOverloaded = errorMessage.includes("503") || errorMessage.includes("overloaded") || errorMessage.includes("internal");
            
            console.warn(`[Attempt ${attempt}/${retries + 1}] AI 호출 실패: ${errorMessage}`);

            if (attempt > retries) {
                console.error(`모든 재시도(${retries}회) 실패.`);
                throw new Error(`AI 분석 최종 실패: ${errorMessage}`);
            }
            
            if (isOverloaded || errorMessage.includes("재시도 필요") || errorMessage.includes("JSON")) {
                const delayTime = attempt * 2000; 
                console.log(`⚠️ 오류 감지. ${delayTime / 1000}초 후 재시도합니다...`);
                await wait(delayTime);
                continue; 
            }
            throw error; 
        }
    }
}


// 예시 데이터
const subjectKeyToExamples = {
    'HIGH_1_MIXED': [
        "유형 01: 두 점 사이의 거리",
        "유형 03: 나머지정리",
        "유형 08: x, y축에 동시에 접하는 원의 방정식",
        "유형 12: 이차함수와 직선의 위치 관계",
        "유형 15: 절대부등식"
    ]
};

function getExamples(subjectKey) {
    let examples = subjectKeyToExamples[subjectKey] || subjectKeyToExamples['HIGH_1_MIXED'];
    return examples.map(ex => `- "${ex}"`).join('\n');
}


// -------------------------------------------------------------------
// 1. (Pro Vision) 유형/난이도/접근포인트/추가학습 "마스터 분석"
// -------------------------------------------------------------------
export async function getQuestionUnitMapping(pdfImages, questionCount, subjectKey) {
    
    const examplesString = getExamples(subjectKey);

    const prompt = `
        당신은 최고의 수학 교사입니다. 첨부된 시험지 이미지를 1번부터 ${questionCount}번까지 문항별로 분석해주세요.

        **분석 요청:**
        각 문항에 대해, **(1)'유형명(unit)'**, **(2)'난이도(difficulty)'**, **(3)'핵심 접근 포인트(analysis_point)'**, **(4)'학습 전략(solution)'**를 JSON 형식으로 반환해주세요.

        [매우 중요 - 작성 규칙]
        1. **난이도**: "A", "B-", "B0", "B+", "C" 5단계 (A=쉬움, C=어려움)
        2. **유형명(unit)**: 
           - 반드시 "유형 XX: [이름]" 형식을 지키세요. (식별 불가시 "유형 99: 기타")
        
        3. **핵심 접근 포인트(analysis_point)**: 
           - 문제를 풀기 위해 가장 먼저 떠올려야 할 아이디어를 **명확하고 간결한 1개의 평서문**으로 작성하세요.
           - 예시: "판별식을 이용하여 실근의 개수를 구해야 합니다."
           
        4. **학습 전략(solution)**: 
           - 이 문제를 틀린 학생에게 필요한 공부 방향을 **구체적인 조언이 담긴 1개의 문장**으로 작성하세요.
           - 예시: "이차함수의 그래프 개형과 축의 방정식을 복습하세요."

        5. **수식 규칙**: 
           - 모든 수식은 KaTeX 형식 ($...$)을 사용하세요.
           - ⭐️ **중요: JSON 포맷이므로 백슬래시(\\)는 반드시 두 번(\\\\) 써야 합니다.** (예: \\ge, \\int, \\text, \\boxed)

        [좋은 예시 - 유형명]
        ${examplesString}

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "question_analysis": [
                { 
                    "qNum": 1, 
                    "unit": "유형 01: 지수법칙", 
                    "difficulty": "A",
                    "analysis_point": "밑을 소인수분해하여 지수법칙을 적용해 식을 정리해야 합니다.",
                    "solution": "지수법칙의 기본 공식들을 다시 한번 암기하고 계산 연습을 하세요."
                },
                { 
                    "qNum": ${questionCount}, 
                    "unit": "...", 
                    "difficulty": "C",
                    "analysis_point": "주어진 조건을 만족하는 $f(x)$의 그래프 개형을 추론해야 합니다.",
                    "solution": "함수의 미분가능성 조건과 그래프의 특징을 연결하는 심화 학습이 필요합니다."
                }
            ]
        }
    `; 
    
    return callAIFunction(callGeminiProVisionFunction, { prompt, images: pdfImages }, 2);
}


// -------------------------------------------------------------------
// 2. (Flash Text) 학생 개별 "강점/약점" 요약
// -------------------------------------------------------------------
export async function getAIAnalysis(student, data, questionMasterAnalysis) {
    const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
    
    const incorrectAnalysisForAI = incorrectAnswers.map(ans => {
        const analysis = questionMasterAnalysis?.question_analysis?.find(item => item.qNum === ans.qNum);
        return {
            qNum: ans.qNum,
            unit: analysis?.unit || "분석 필요",
            difficulty: analysis?.difficulty || "N/A"
        };
    });

    if (incorrectAnalysisForAI.length === 0) {
        return Promise.resolve({
            "strengths": `총점 ${student.score}점으로, 모든 문제를 맞혔습니다. 이는 반 평균(${data.classAverage}점)보다 월등히 높은 점수이며, 시험 범위에 대한 개념을 완벽하게 숙지하고 있음을 보여줍니다.`,
            "weaknesses": "특별한 약점이 발견되지 않았습니다. 현재의 학습 페이스를 유지하며 심화 문제에 도전하는 것을 추천합니다.",
            "recommendations": "지금처럼 꾸준히 학습하며, 고난도 심화 문제 풀이를 통해 실력을 더욱 견고히 다지시기 바랍니다."
        });
    }

    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학생의 수학 시험 결과와, 틀린 문항들의 유형 정보입니다.

        **학생 정보:**
        - 점수: ${student.score}점 (반 평균: ${data.classAverage}점)

        **틀린 문항 정보:**
        ${JSON.stringify(incorrectAnalysisForAI, null, 2)}
        
        **요청:**
        학생의 점수와 틀린 문제의 유형/난이도를 바탕으로 **(1)강점, (2)약점, (3)학습 추천 방안**을 요약해주세요.
        - 학생에게 말하듯이 자연스러운 문체("~합니다", "~하세요")를 사용하세요.
        - 너무 기계적이지 않게 작성해주세요.

        **결과 형식 (JSON):**
        {
            "strengths": "...",
            "weaknesses": "...",
            "recommendations": "..."
        }
    `;
    
    return callAIFunction(callGeminiAPIFunction, { prompt }, 2);
}


// -------------------------------------------------------------------
// 3. (Flash Text) 반 전체 총평
// -------------------------------------------------------------------
export async function getOverallAIAnalysis(data) {
    const highErrorRateQuestions = [];
    data.answerRates.forEach((rate, i) => {
        if (rate <= 40) { 
            highErrorRateQuestions.push({ qNum: i + 1, rate: 100 - rate });
        }
    });
    highErrorRateQuestions.sort((a,b) => b.rate - a.rate);
    
    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 반 전체의 수학 시험 결과입니다.

        **데이터:**
        - 반 평균: ${data.classAverage}점 
        - 오답률 높은 문항: ${JSON.stringify(highErrorRateQuestions, null, 2)}
        
        **요청:**
        교사를 위해 **(1)종합 총평, (2)공통 약점, (3)수업 지도 방안**을 요약해주세요.
        - 핵심 내용을 명확하게 전달하는 문장으로 작성하세요.

        **결과 형식 (JSON):**
        {
            "summary": "...",
            "common_weaknesses": "...",
            "recommendations": "...",
            "question_analysis": [] 
        }
    `;
    
    return callAIFunction(callGeminiAPIFunction, { prompt }, 2);
}