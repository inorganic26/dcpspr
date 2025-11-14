// scr/lib/ai.js 파일 내용

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebaseConfig'; 

// ⭐️ [수정] 백엔드와 동일한 리전("asia-northeast3")으로 변경
const functions = getFunctions(db.app, "asia-northeast3"); 
const callGeminiAPIFunction = httpsCallable(functions, 'callGeminiAPI'); // ⭐️ 2.5-flash (Text)용
// ⭐️ [신규] 1.5-pro (Vision)용 함수 임포트
const callGeminiProVisionFunction = httpsCallable(functions, 'callGeminiProVisionAPI');


// ⭐️ [수정] AI 응답 파싱 함수 (안정성 강화)
function parseAIResponse(response) {
    let jsonString = response.trim();
    
    // 1. AI가 마크다운 블록(```json ... ```)을 포함한 경우 제거
    const match = jsonString.match(/```json([\s\S]*?)```/);
    if (match && match[1]) {
        jsonString = match[1].trim();
    }
    
    // 2. JSON 파싱 시도
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", e);
        console.error("Problematic JSON string:", jsonString); // ⭐️ 파싱 실패한 문자열 로깅
        // ⭐️ [수정] 재시도를 위해 파싱 오류도 Error로 throw
        throw new Error("AI가 유효하지 않은 JSON 형식으로 응답했습니다.");
    }
}

// ⭐️ [수정] AI 호출 함수 (자동 재시도 로직 추가)
// (Text 모델과 Vision 모델 모두 이 재시도 로직을 사용)
async function callAIFunction(fnToCall, payload, retries = 2) { // ⭐️ 재시도 1회 (총 2회)
    
    console.log(`[Cloud Function Call] Prompt length: ${payload.prompt.length} chars`);
    
    let lastError = null; // 마지막 오류를 저장할 변수

    for (let attempt = 1; attempt <= retries; attempt++) {
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
            
            // ⭐️ [신규] 응답 내용 검증 (유형명 분석 실패 시 재시도 유도)
            if (parsedResponse.question_analysis && parsedResponse.question_analysis.some(u => (u.unit && u.unit.includes("분석")) || (u.analysis_point && u.analysis_point.includes("부족")))) {
                 console.warn(`[Attempt ${attempt}] AI content failure: "유형 분석 필요" 감지. 재시도합니다...`);
                 throw new Error("AI가 유효한 유형명을 반환하지 못했습니다.");
            }

            return parsedResponse; // ⭐️ 성공 시 루프 종료 및 반환

        } catch (error) {
            lastError = error; // ⭐️ 오류 저장
            console.warn(`[Attempt ${attempt}/${retries}] AI 호출 실패: ${error.message}`);
            
            // ⭐️ API 키 유출(403) 같은 영구적 오류는 즉시 중단
            if (error.message && (error.message.includes("403") || error.message.includes("404"))) {
                console.error("영구적인 오류(403/404)이므로 재시도를 중단합니다.");
                break; 
            }
            
            if (attempt < retries) {
                // ⭐️ 재시도 전 1초 대기
                await new Promise(res => setTimeout(res, 1000));
            }
        }
    }

    // ⭐️ 모든 재시도 실패 시, 마지막 오류를 throw
    console.error(`AI 분석이 모든 재시도(${retries}회)에 실패했습니다.`);
    const errorMessage = lastError.message || "알 수 없는 오류";
    const errorCode = lastError.code || "internal";
    throw new Error(`AI 분석(Cloud Function) 호출 실패: ${errorCode} - ${errorMessage}`);
}


// ⭐️ [기존] 하드코딩된 예시 목록 (과목 키별)
const subjectKeyToExamples = {
    'MID_3': [
        "유형 01: 삼각비의 뜻",
        "유형 02: 특수한 각의 삼각비의 값",
        "유형 05: 이차함수의 최댓값과 최솟값",
        "유형 08: 피타고라스 정리의 활용",
        "유형 10: 원주각의 성질",
        "유형 15: 표준편차와 분산"
    ],
    'HIGH_1_1': [
        "유형 01: 다항식의 덧셈과 뺄셈",
        "유형 03: 곱셈 공식",
        "유형 05: 나머지정리",
        "유형 08: 이차방정식의 근과 계수의 관계",
        "유형 12: 이차함수와 직선의 위치 관계"
    ],
    'HIGH_1_2': [
        "유형 01: 두 점 사이의 거리",
        "유형 05: 선분의 길이의 제곱의 합의 최솟값",
        "유형 08: x, y축에 동시에 접하는 원의 방정식",
        "유형 10: 집합의 연산법칙",
        "유형 15: 절대부등식"
    ],
    'HIGH_1_MIXED': [
        "유형 01: 두 점 사이의 거리",
        "유형 03: 나머지정리",
        "유형 08: x, y축에 동시에 접하는 원의 방정식",
        "유형 12: 이차함수와 직선의 위치 관계",
        "유형 15: 절대부등식"
    ],
    'HIGH_2_SU1': [ 
        "유형 01: 지수법칙",
        "유형 03: 로그의 성질",
        "유형 05: 삼각함수의 정의",
        "유형 08: 등차수열의 일반항"
    ],
    'HIGH_2_SU2': [ 
        "유형 01: 함수의 극한",
        "유형 02: 함수의 연속",
        "유형 05: 미분계수",
        "유형 07: 도함수의 활용 (접선)",
        "유형 10: 함수의 증가와 감소",
        "유형 12: 부정적분",
        "유형 15: 정적분의 계산"
    ],
    'HIGH_2_DAESU': [ 
        "유형 01: 지수법칙",
        "유형 03: 로그의 성질",
        "유형 05: 삼각함수의 정의",
        "유형 10: 함수의 극한",
        "유형 12: 미분계수",
        "유형 15: 부정적분"
    ]
};

// ⭐️ [기존] 예시를 가져오는 헬퍼 함수
function getExamples(subjectKey) {
    let examples = subjectKeyToExamples[subjectKey];
    if (!examples || examples.length === 0) {
        console.warn(`getQuestionUnitMapping: '${subjectKey}'에 대한 예시가 없어 기본 예시를 사용합니다.`);
        examples = subjectKeyToExamples['HIGH_1_MIXED'];
    }
    return examples.map(ex => `- "${ex}"`).join('\n');
}


// -------------------------------------------------------------------
// ⭐️ [수정] 1. (Pro Vision) 유형/난이도/분석포인트/대응방안 "마스터 분석"
// -------------------------------------------------------------------
export async function getQuestionUnitMapping(pdfImages, questionCount, subjectKey) {
    
    const examplesString = getExamples(subjectKey);

    const prompt = `
        당신은 최고의 수학 교사입니다. 첨부된 시험지 이미지를 1번부터 ${questionCount}번까지 문항별로 분석해주세요.

        **분석 요청:**
        각 문항에 대해, RPM 수학 교재의 유형명처럼 **(1)매우 세부적인 '유형명(unit)'**, **(2)'난이도(difficulty)'**, **(3)'분석 포인트(analysis_point)'**, **(4)'오답 대응 방안(solution)'**을 JSON 형식으로 반환해주세요.

        [매우 중요]
        - 난이도는 "A", "B-", "B0", "B+", "C" 5단계로 분류해주세요. (A = 가장 쉬움, B0 = 보통, C = 가장 어려움)
        - "분석 포인트"는 이 문제를 틀리는 핵심 이유입니다.
        - "오답 대응 방안"은 이 유형을 마스터하기 위한 구체적인 학습 전략입니다.
        
        [좋은 예시 - 유형명]
        ${examplesString}

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "question_analysis": [
                { 
                    "qNum": 1, 
                    "unit": "유형 01: ...", 
                    "difficulty": "A",
                    "analysis_point": "단순 계산 실수 또는 개념 이해 부족",
                    "solution": "교과서의 기본 정의를 다시 읽고, 예제 문제를 반복 풀이하세요."
                },
                { 
                    "qNum": ${questionCount}, 
                    "unit": "...", 
                    "difficulty": "C",
                    "analysis_point": "여러 개념이 복합된 킬러 문항으로, 조건 해석 실패",
                    "solution": "문제를 조건별로 분해하고, 각 조건이 의미하는 바를 그래프로 그리는 연습이 필요합니다."
                }
            ]
        }
    `; 
    
    // ⭐️ [수정] Pro Vision 함수 호출 (재시도 2회)
    return callAIFunction(callGeminiProVisionFunction, { prompt, images: pdfImages }, 2); // ⭐️ 재시도 2회
}


// -------------------------------------------------------------------
// ⭐️ [수정] 2. (Flash Text) 학생 개별 "강점/약점" 요약
// -------------------------------------------------------------------
// ⭐️ [수정] aiAnalysis(개별분석)이 아닌 questionMasterAnalysis(마스터분석표)를 받음
export async function getAIAnalysis(student, data, questionMasterAnalysis) {
    const incorrectAnswers = student.answers.filter(a => !a.isCorrect);
    
    // ⭐️ [신규] Pro Vision이 분석한 '마스터 분석표'에서 오답 정보만 추출
    const incorrectAnalysisForAI = incorrectAnswers.map(ans => {
        // ⭐️ [수정] 'questionMasterAnalysis'는 이제 .question_analysis 배열을 가짐
        const analysis = questionMasterAnalysis?.question_analysis?.find(item => item.qNum === ans.qNum);
        return {
            qNum: ans.qNum,
            unit: analysis?.unit || "분석 필요",
            difficulty: analysis?.difficulty || "N/A"
        };
    });

    if (incorrectAnalysisForAI.length === 0) {
        return Promise.resolve({
            "strengths": `총점 ${student.score}점으로, 모든 문제를 맞혔습니다. 이는 반 평균(${data.classAverage}점)보다 월등히 높은 점수이며, 시험 범위에 대한 개념을 완벽하게 숙지하고 있음을 보여줍니다. 특히 고난도 문항까지 실수 없이 해결한 점이 인상적입니다.`,
            "weaknesses": "특별한 약점이 발견되지 않았습니다. 현재의 학습 페이스를 유지하며 심화 문제에 도전하는 것을 추천합니다.",
            "recommendations": "지금처럼 꾸준히 학습하며, 다양한 유형의 심화 문제와 경시 대회 문제 등을 통해 문제 해결 능력을 더욱 향상시키는 것이 좋습니다. 또한, 새로운 개념을 학습할 때에도 현재와 같은 깊이 있는 탐구 자세를 유지하시기 바랍니다."
        });
    }

    const prompt = `
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학생의 수학 시험 결과와, 해당 시험 문항들에 대해 **미리 분석된 '마스터 분석표'**입니다.

        **학생 정보:**
        - 점수: ${student.score}점
        - 반 평균 점수: ${data.classAverage}점 

        **학생이 틀린 문항의 '마스터 분석' 정보:**
        (이 정보는 학생의 답안과 무관한, 시험지 자체에 대한 객관적인 분석입니다.)
        ${JSON.stringify(incorrectAnalysisForAI, null, 2)}
        
        **요청:**
        오직 학생의 점수, 반 평균, 그리고 **틀린 문제의 유형과 난이도**만을 바탕으로 학생의 **(1)강점, (2)약점, (3)학습 추천 방안**을 요약해주세요.
        
        [매우 중요]
        - 절대로 "분석 포인트"나 "오답 대응 방안"을 여기서 생성하지 마세요.
        - 학생의 주어를 생략하여 서술하세요.

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "strengths": "분석된 강점 내용 (예: C 난이도 킬러 문항을 맞춘 점이 돋보입니다.)",
            "weaknesses": "분석된 약점 내용 (예: B+ 난이도의 '원의 방정식' 유형에 대한 반복적인 실수가 보입니다.)",
            "recommendations": "학습 추천 내용 (예: '원의 방정식' 유형을 집중적으로 복습하세요.)"
        }
    `;
    
    // ⭐️ [수정] Flash Text 함수 호출 (재시도 2회)
    return callAIFunction(callGeminiAPIFunction, { prompt }, 2); // ⭐️ 재시도 2회
}


// -------------------------------------------------------------------
// ⭐️ 3. (Flash Text) 반 전체 총평 (변경 없음)
// -------------------------------------------------------------------
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
        당신은 데이터 기반 교육 컨설턴트입니다. 다음은 한 학급의 수학 시험 결과 데이터와 시험지 텍스트입니다. 이 데이터를 바탕으로 반 전체의 학습 상황을 분석하고, 교사를 위한 **(1)종합 총평, (2)공통 약점, (3)수업 지도 방안**을 요약해주세요.
        (참고: 세부 문항 분석은 별도로 제공될 것이므로, 여기서는 전체적인 경향성만 분석합니다.)

        **반 전체 데이터:**
        - 반 평균 점수: ${data.classAverage}점 
        - 총 문항 수: ${data.questionCount}개 
        
        **시험지 텍스트 (참고용):**
        ${data.pdfInfo.fullText.substring(0, 8000)}
        
        **주요 오답 문항 정보 (정답률 40% 이하):**
        ${JSON.stringify(highErrorRateQuestions, null, 2)}

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "summary": "종합 총평 내용",
            "common_weaknesses": "공통 약점 분석 내용",
            "recommendations": "수업 지도 방안 추천 내용",
            "question_analysis": [] 
        }
    `;
    
    // ⭐️ [수정] Flash Text 함수 호출 (재시도 2회)
    return callAIFunction(callGeminiAPIFunction, { prompt }, 2); // ⭐️ 재시도 2회
}