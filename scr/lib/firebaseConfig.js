// scr/lib/firebaseConfig.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; 

// ✅ Firebase 설정 (spra-v1 기준)
const REAL_FIREBASE_CONFIG = {
  // ⭐️ 새 웹 API 키로 교체되었습니다.
  apiKey: "AIzaSyBAwIgX8FIeBMnNARNiDRiCuBqnb-b6NJo", 
  
  authDomain: "spra-v1.firebaseapp.com",
  projectId: "spra-v1",
  storageBucket: "spra-v1.firebasestorage.app", 
  messagingSenderId: "735477807243",
  // ⭐️ 새 appId로 교체되었습니다.
  appId: "1:735477807243:web:289b879b929c021d997c8e",
  // ⭐️ measurementId가 추가되었습니다.
  measurementId: "G-JMDL5Z9X7V"
};

const appId = REAL_FIREBASE_CONFIG.appId;
let firebaseApp;

// 앱이 중복 초기화되는 것을 방지
if (getApps().length === 0) {
  firebaseApp = initializeApp(REAL_FIREBASE_CONFIG);
} else {
  // 앱이 이미 초기화된 경우, 앱 ID를 기준으로 가져옵니다.
  firebaseApp = getApp(appId);
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);