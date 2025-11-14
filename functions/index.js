// functions/index.js

const { onCall } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const fetch = require("node-fetch"); 

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const REGION = "asia-northeast3";

// ⭐️ 1. Text 모델 (사용자님 요청대로 'gemini-2.5-flash' 사용)
const TEXT_MODEL = "gemini-2.5-flash";
exports.callGeminiAPI = onCall({
  region: REGION, 
  secrets: [GEMINI_API_KEY],
  timeoutSeconds: 120,
}, async (request) => {

  const prompt = request.data.prompt;
  if (!prompt) {
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("invalid-argument", "prompt가 필요합니다.");
  }

  const apiKey = GEMINI_API_KEY.value();
  
  // ⭐️ [수정] API 엔드포인트를 'v1beta'로 변경 (v1에서 404 오류 발생)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[Cloud Function] (Text, ${REGION}) Gemini API 호출 (Model: ${TEXT_MODEL}, Prompt: ${prompt.length} chars)`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Gemini API Error (Back-end, Text):", errorBody);
      const errorDetail = errorBody.error?.message || '알 수 없는 오류';
      const functions = require("firebase-functions");
      throw new functions.https.HttpsError("internal", `Gemini API(Text) 호출 실패: ${response.status} - ${errorDetail}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
        console.error("Gemini API Error (Back-end, Text):", data); 
        const functions = require("firebase-functions");
        throw new functions.https.HttpsError("internal", "AI(Text)로부터 유효한 응답 텍스트를 받지 못했습니다.");
    }
    return responseText;

  } catch (error) {
    console.error("Cloud Function Error (Text):", error);
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("internal", error.message);
  }
});


// ⭐️ 2. Vision 모델 ('gemini-2.5-pro' 사용)
const VISION_MODEL = "gemini-2.5-pro";
exports.callGeminiProVisionAPI = onCall({
  region: REGION,
  secrets: [GEMINI_API_KEY],
  timeoutSeconds: 540, 
}, async (request) => {
    
  const { prompt, images } = request.data; 

  if (!prompt || !images || !Array.isArray(images) || images.length === 0) {
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("invalid-argument", "prompt와 1개 이상의 image 배열이 필요합니다.");
  }

  const apiKey = GEMINI_API_KEY.value();
  
  // ⭐️ [수정] API 엔드포인트를 'v1beta'로 변경
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${apiKey}`;

  console.log(`[Cloud Function] (Vision, ${REGION}) Gemini API 호출 (Model: ${VISION_MODEL}, Images: ${images.length}장)`);

  const parts = [
    { text: prompt },
    ...images.map(imgBase64 => ({
        inlineData: {
            mimeType: "image/jpeg",
            data: imgBase64 
        }
    }))
  ];

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: parts }], 
        generationConfig: {
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error("Gemini API Error (Back-end, Vision):", errorBody);
      const errorDetail = errorBody.error?.message || '알 수 없는 오류';
      const functions = require("firebase-functions");
      throw new functions.https.HttpsError("internal", `Gemini API(Vision) 호출 실패: ${response.status} - ${errorDetail}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      console.error("Gemini API Error (Back-end, Vision):", data); 
      const functions = require("firebase-functions");
      throw new functions.https.HttpsError("internal", "AI(Vision)로부터 유효한 응답 텍스트를 받지 못했습니다.");
    }
    return responseText;

  } catch (error) {
    console.error("Cloud Function Error (Vision):", error);
    const functions = require("firebase-functions");
    throw new functions.https.HttpsError("internal", error.message);
  }
});