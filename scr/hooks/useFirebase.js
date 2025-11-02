// scr/hooks/useFirebase.js

import { useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { 
    // ⭐️ [수정] 표준 getFirestore를 다시 사용합니다.
    getFirestore, doc, setDoc, getDoc
    // ⭐️ 'initializeFirestore'와 'memoryLocalCache'는 사용하지 않습니다.
} from "firebase/firestore";
import { 
    getAuth, signInAnonymously, onAuthStateChanged 
} from "firebase/auth";
import { useReportContext } from '../context/ReportContext';

// Firebase 설정 객체 (기존과 동일)
const firebaseConfig = {
    apiKey: "AIzaSyCE4e23T5uHUg8HevbOV0Opl-upgUeIG-g",
    authDomain: "dcpspr-b088f.firebaseapp.com",
    databaseURL: "https://dcpspr-b088f-default-rtdb.firebaseio.com",
    projectId: "dcpspr-b088f",
    storageBucket: "dcpspr-b088f.appspot.com",
    messagingSenderId: "1001893335270",
    appId: "1:1001893335270:web:1669430c6c5477c77f02a0",
    measurementId: "G-5GM7206103"
};

const app = initializeApp(firebaseConfig);

// ⭐️ [수정] '400 Bad Request' 오류를 수정하기 위해 
// ⭐️ 표준 초기화로 되돌립니다.
const db = getFirestore(app);
// --------------------------------------------------

const auth = getAuth(app);
const dataDocRef = doc(db, "reports", "allTestData");

export const useFirebase = () => {
    const { 
        setTestData, setInitialLoading, 
        setAuthError 
    } = useReportContext();

    // 익명 로그인 및 데이터 로드 로직
    useEffect(() => {
        setInitialLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Firebase: 인증 성공 (익명)", user.uid);
                setAuthError(null); 
                await loadDataFromFirestore();
            } else {
                console.log("Firebase: 인증 시도 (익명)...");
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Firebase: 익명 로그인 실패", error);
                    setAuthError(error.message); 
                    setInitialLoading(false); 
                }
            }
        });
        return () => unsubscribe();
    }, [setAuthError, setInitialLoading]);

    // loadDataFromFirestore 함수 (방안 2의 오류 처리 로직 유지)
    const loadDataFromFirestore = async () => {
        try {
            if (!navigator.onLine) {
                console.warn("Firebase: 오프라인 상태입니다.");
                setAuthError("현재 오프라인 상태입니다. 인터넷 연결을 확인해주세요.");
            }

            // ⭐️ 이제 이 getDoc이 'permission-denied' 오류를 정확히 반환할 것입니다.
            const docSnap = await getDoc(dataDocRef);
            
            if (docSnap.exists()) {
                setTestData(docSnap.data() || {});
                console.log("Firebase: 데이터 로드 성공");
                setAuthError(null); 
            } else {
                console.log("Firebase: 문서 없음. 새 데이터로 시작.");
                setTestData({});
                setAuthError(null); 
            }
        } catch (error) {
            console.error("Firebase: 데이터 로드 실패", error);
            
            if (error.code === 'unavailable' || error.message.includes('offline')) {
                setAuthError("네트워크 연결이 불안정합니다. 잠시 후 다시 시도해주세요.");
            } else if (error.code === 'permission-denied') {
                // ⭐️⭐️⭐️ 진짜 오류가 여기에 잡힐 것입니다. ⭐️⭐️⭐️
                setAuthError("데이터 접근 권한이 없습니다. (방안 1: Firestore 보안 규칙을 확인해주세요.)");
            } else {
                setAuthError("데이터 로드 중 오류 발생: " + error.message);
            }
            
            setTestData({});
        } finally {
            setInitialLoading(false);
        }
    };

    // 데이터 저장 함수 (기존과 동일)
    const saveDataToFirestore = async (data) => {
        if (!auth.currentUser) {
            console.error("Firebase: 인증되지 않아 저장할 수 없습니다.");
            throw new Error("Firebase 인증이 필요합니다.");
        }
        try {
            await setDoc(dataDocRef, data, { merge: true }); 
            console.log("Firebase: 데이터 저장 성공");
        } catch (error) {
            console.error("Firebase: 데이터 저장 실패", error);
            throw error;
        }
    };

    return { saveDataToFirestore, loadDataFromFirestore };
};