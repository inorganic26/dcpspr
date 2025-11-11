// functions/index.js

const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const fetch = require("node-fetch"); 

// 1. 등록한 비밀 API 키를 불러옵니다.
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-1.5-flash"; // ⭐️ 1.5-flash로 모델 변경 (성능 향상)

/**
 * 프론트엔드(React)에서 호출할 Cloud Function
 */
exports.callGeminiAPI = onCall({
  secrets: [GEMINI_API_KEY], // 비밀 키 사용 설정
}, async (request) => {
  
  // 2. 프론트엔드에서 보낸 'prompt' 데이터를 받습니다.
  const prompt = request.data.prompt;
  if (!prompt) {
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("invalid-argument", "prompt가 필요합니다.");
  }
  
  // 3. API 키는 process.env에서 안전하게 접근합니다.
  const apiKey = GEMINI_API_KEY.value();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[Cloud Function] Gemini API 호출 (Model: ${GEMINI_MODEL}, Prompt: ${prompt.length} chars)`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          // ⭐️ [수정] JSON 형식을 강제하면 오히려 오류가 날 수 있으므로,
          // AI가 텍스트로 JSON 문자열을 반환하도록 이 옵션을 제거합니다.
          // responseMimeType: "application/json", 
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Gemini API Error (Back-end):", errorBody);
      const errorDetail = errorBody.error?.message || '알 수 없는 오류';
      const functions = require("firebase-functions");
      throw new functions.https.HttpsError("internal", `Gemini API 호출 실패: ${response.status} - ${errorDetail}`);
    }

    const data = await response.json();
    
    // ⭐️ [수정] AI 응답 텍스트 추출 (안전하게)
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
        console.error("Gemini API Error (Back-end):", data); // ⭐️ 응답 전체를 로깅
        const functions = require("firebase-functions");
        throw new functions.https.HttpsError("internal", "AI로부터 유효한 응답 텍스트를 받지 못했습니다. (candidates 또는 text 없음)");
    }

    // 4. 프론트엔드로 '텍스트'만 반환합니다.
    return responseText;

  } catch (error) {
    console.error("Cloud Function Error:", error);
    if (error.code) { // HttpsError는 code 속성을 가짐
      throw error;
    }
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("internal", error.message);
  }
});