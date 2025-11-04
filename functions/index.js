// functions/index.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

// 환경 변수로 API 키 정의
const GEMINI_API_KEY = defineString("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.0-flash-exp";

/**
 * 프론트엔드(React)에서 호출할 Cloud Function
 */
exports.callGeminiAPI = onCall(async (request) => {
  
  // API 키 가져오기
  const apiKey = GEMINI_API_KEY.value();
  
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "GEMINI_API_KEY가 설정되지 않았습니다.");
  }

  // 프론트엔드에서 보낸 'prompt' 데이터를 받습니다.
  const prompt = request.data.prompt;
  if (!prompt) {
    throw new HttpsError("invalid-argument", "prompt가 필요합니다.");
  }
  
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
      throw new HttpsError("internal", `Gemini API 호출 실패: ${response.status} - ${errorDetail}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new HttpsError("internal", "AI로부터 유효한 응답 텍스트를 받지 못했습니다.");
    }

    return { result: responseText };

  } catch (error) {
    console.error("Cloud Function Error:", error);
    if (error.code) { 
      throw error;
    }
    throw new HttpsError("internal", error.message);
  }
});