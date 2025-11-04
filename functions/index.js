// functions/index.js

const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const fetch = require("node-fetch"); 

// 1. 등록한 비밀 API 키를 불러옵니다.
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * 프론트엔드(React)에서 호출할 Cloud Function
 */
exports.callGeminiAPI = onCall({
  secrets: [GEMINI_API_KEY], // 비밀 키 사용 설정
}, async (request) => {
  
  // 2. 프론트엔드에서 보낸 'prompt' 데이터를 받습니다.
  const prompt = request.data.prompt;
  if (!prompt) {
    // ⭐️ functions.https.HttpsError를 사용하기 위해 v2/https에서 import해야 함
    // (하지만 onCall을 쓰면 자동으로 functions 객체를 쓸 수 있습니다 - 확인 필요)
    // ⭐️ const { https } = require("firebase-functions/v2"); // <- 이 줄이 없어도 onCall 내부에서는 HttpsError를 바로 쓸 수 있어야 합니다.
    // ⭐️ 만약 HttpsError가 없다고 나오면 new Error(...)로 바꾸는 것이 좋습니다.
    // ⭐️ 아니면 const functions = require("firebase-functions"); 를 상단에 추가합니다.
    // ⭐️ 가장 호환성이 좋은 코드로 수정합니다.
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("invalid-argument", "prompt가 필요합니다.");
  }
  
  // 3. API 키는 process.env에서 안전하게 접근합니다. (절대 노출 안됨)
  const apiKey = GEMINI_API_KEY.value();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[Cloud Function] Gemini API 호출 (Prompt: ${prompt.length} chars)`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
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
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      const functions = require("firebase-functions");
      throw new functions.https.HttpsError("internal", "AI로부터 유효한 응답 텍스트를 받지 못했습니다.");
    }

    // 4. [오타 수정 완료] 프론트엔드로 '텍스트'만 반환합니다.
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