// scr/lib/ai.js 파일 내용

import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebaseConfig'; 

// ⭐️ [수정] 백엔드와 동일한 리전("asia-northeast3")으로 변경
const functions = getFunctions(db.app, "asia-northeast3"); 

// ⭐️ [수정] 클라이언트 타임아웃을 10분(600,000ms)으로 설정
const longTimeoutOptions = { timeout: 600000 }; 

// ⭐️ [수정] 10분 타임아웃 옵션을 적용하여 함수를 정의
const callGeminiAPIFunction = httpsCallable(functions, 'callGeminiAPI', longTimeoutOptions); // ⭐️ 2.5-flash (Text)용
const callGeminiProVisionFunction = httpsCallable(functions, 'callGeminiProVisionAPI', longTimeoutOptions); // ⭐️ 2.5-pro (Vision)용


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

// ⭐️ [수정] AI 호출 함수 (재시도 로직 복구 및 강화)
async function callAIFunction(fnToCall, payload, retries = 3) { // ⭐️ 기본 재시도 횟수 3회로 설정
    
    console.log(`[Cloud Function Call] Prompt length: ${payload.prompt.length} chars`);

    // 재시도 간 딜레이 함수 (ms)
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            // 1. AI 호출
            const result = await fnToCall(payload);
            
            // 2. 응답 데이터 파싱
            const responseData = result.data;
            let responseText;

            if (typeof responseData === 'string') {
                responseText = responseData;
            } else if (responseData && typeof responseData.result === 'string') {
                responseText = responseData.result;
            } else {
                // 응답이 이상하면 에러 처리 (이 경우엔 재시도해도 소용없을 수 있으므로 바로 throw)
                console.error("Cloud Function에서 유효하지 않은 응답을 받았습니다:", responseData);
                throw new Error("AI(Cloud Function)로부터 유효한 응답 텍스트를 받지 못했습니다.");
            }
            
            // 3. JSON 파싱
            const parsedResponse = parseAIResponse(responseText);
            
            // 4. 내용 검증 ('분석 필요' 같은 모호한 답변 걸러내기)
            if (parsedResponse.question_analysis && parsedResponse.question_analysis.some(u => (u.unit && u.unit.includes("분석")))) {
                 console.warn(`[Attempt ${attempt}] AI content failure: "유형 분석 필요" 감지.`);
                 // 마지막 시도가 아니면 에러를 던져서 재시도 유도
                 if (attempt <= retries) {
                     throw new Error("AI가 유효한 유형명을 반환하지 못했습니다. (재시도 필요)");
                 }
            }

            // 5. 성공 시 반환
            return parsedResponse; 

        } catch (error) {
            const errorMessage = error.message || "알 수 없는 오류";
            const isOverloaded = errorMessage.includes("503") || errorMessage.includes("overloaded") || errorMessage.includes("internal");
            
            console.warn(`[Attempt ${attempt}/${retries + 1}] AI 호출 실패: ${errorMessage}`);

            // 6. 재시도 결정 로직
            // 마지막 시도이거나, 재시도해도 소용없는 에러(프롬프트 오류 등)가 아니면 종료
            if (attempt > retries) {
                console.error(`모든 재시도(${retries}회) 실패.`);
                throw new Error(`AI 분석 최종 실패: ${errorMessage}`);
            }
            
            // 503(과부하) 오류이거나 "AI 결과 내용 문제"라면 잠시 대기 후 재시도
            if (isOverloaded || errorMessage.includes("재시도 필요")) {
                const delayTime = attempt * 2000; // 2초, 4초, 6초... 점진적으로 대기
                console.log(`⚠️ 서버 과부하 또는 분석 오류 감지. ${delayTime / 1000}초 후 재시도합니다...`);
                await wait(delayTime);
                continue; // 다음 루프로 이동 (재시도)
            }

            // 그 외의 오류(예: 인증 오류, 잘못된 인자)는 즉시 중단
            throw error; 
        }
    }
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
// ⭐️ [수정] 1. (Pro Vision) 유형/난이도/접근포인트/추가학습 "마스터 분석"
// -------------------------------------------------------------------
export async function getQuestionUnitMapping(pdfImages, questionCount, subjectKey) {
    
    const examplesString = getExamples(subjectKey);

    // ⭐️ [수정] 프롬프트 규칙 강화: '분석 포인트'를 '접근 아이디어'로 변경
    const prompt = `
        당신은 최고의 수학 교사입니다. 첨부된 시험지 이미지를 1번부터 ${questionCount}번까지 문항별로 분석해주세요.

        **분석 요청:**
        각 문항에 대해, **(1)'유형명(unit)'**, **(2)'난이도(difficulty)'**, **(3)'핵심 접근 포인트(analysis_point)'**, **(4)'추가 학습 키워드(solution)'**를 JSON 형식으로 반환해주세요.

        [매우 중요 - 작성 규칙]
        1. **난이도**: "A", "B-", "B0", "B+", "C" 5단계 (A=쉬움, C=어려움)
        2. **유형명(unit)**: 
           - 반드시 "유형 XX: [이름]" 형식을 지키세요. (식별 불가시 "유형 99: 기타")
           - "분석", "부족" 같은 모호한 단어는 쓰지 마세요.
        
        3. ⭐️ **핵심 접근 포인트(analysis_point)** [변경됨]: 
           - 이 문제는 학생들이 어디서 실수를 하는지가 아니라, **"문제를 풀기 위해 가장 먼저 떠올려야 할 핵심 아이디어"**나 **"접근 방법"**을 적어주세요.
           - **규칙**: 명사형 나열이 아닌, **"~를 이용하여 ~구하기", "~조건을 ~로 변형하기"** 처럼 **구체적인 행동이 담긴 간결한 문장**으로 작성하세요. (공백 포함 30자 이내)
           
        4. **추가 학습 키워드(solution)**: 
           - 이 문제를 마스터하기 위해 공부해야 할 개념 키워드를 3~5단어 이내로 적어주세요.

        5. **수식 규칙**: 모든 수식은 KaTeX 형식 ($...$)을 사용하세요.

        [좋은 예시 - 유형명]
        ${examplesString}

        [좋은 예시 - 핵심 접근 포인트 (접근 방법)]
        - "판별식 $D \\ge 0$을 이용하여 미지수 범위 구하기"
        - "이차함수 그래프를 그려 축의 위치 확인하기"
        - "주어진 식을 $t$로 치환하여 범위 재설정하기"
        - "보조선을 그어 닮음비 활용하기"

        [좋은 예시 - 추가 학습 키워드]
        - "이차부등식의 해"
        - "삼각함수의 합성"
        - "도함수의 활용"

        **결과는 반드시 다음 JSON 형식으로만 반환해주세요. 설명이나 다른 텍스트는 포함하지 마세요:**
        {
            "question_analysis": [
                { 
                    "qNum": 1, 
                    "unit": "유형 01: 지수법칙", 
                    "difficulty": "A",
                    "analysis_point": "밑을 통일하여 지수끼리 비교하기",
                    "solution": "지수법칙과 로그의 정의"
                },
                { 
                    "qNum": ${questionCount}, 
                    "unit": "...", 
                    "difficulty": "C",
                    "analysis_point": "조건을 만족하는 그래프 개형 추론하기",
                    "solution": "함수의 연속과 미분가능성"
                }
            ]
        }
    `; 
    
    // ⭐️ 재시도 로직이 적용된 callAIFunction 호출 (retries: 2)
    return callAIFunction(callGeminiProVisionFunction, { prompt, images: pdfImages }, 2);
}


// -------------------------------------------------------------------
// ⭐️ [수정] 2. (Flash Text) 학생 개별 "강점/약점" 요약
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
    
    return callAIFunction(callGeminiAPIFunction, { prompt }, 2);
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
    
    return callAIFunction(callGeminiAPIFunction, { prompt }, 2);
}