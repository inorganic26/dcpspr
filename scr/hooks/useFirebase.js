import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { useReportContext } from '../context/ReportContext';

// Firebase 설정
const REAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDVLes7sjhRfUgsW2bw1_Sco5ZBx--pudQ",
  authDomain: "spra-v1.firebaseapp.com",
  projectId: "spra-v1",
  storageBucket: "spra-v1.appspot.com",
  messagingSenderId: "735477807243",
  appId: "1:735477807243:web:6c7fdd347a498780997c8e"
};
const appId = REAL_FIREBASE_CONFIG.appId;
const firebaseConfig = REAL_FIREBASE_CONFIG;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

const getReportDocRef = (db, auth, userId) => {
    if (!userId) return null;
    return doc(db, `artifacts/${appId}/users/${userId}/reports/allData`);
};

export const useFirebase = () => {
    const { setTestData, setCurrentPage, setInitialLoading, setErrorMessage } = useReportContext();
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [dbRef, setDbRef] = useState(null);
    const [authError, setAuthError] = useState(null);

    // 데이터 저장
    const saveDataToFirestore = useCallback(async (data) => {
        if (!dbRef) throw new Error("Firestore not initialized for saving.");
        
        const simpleStringify = (obj) => {
            let cache = new Set();
            let str = JSON.stringify(obj, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (cache.has(value)) return;
                    cache.add(value);
                }
                return value;
            });
            cache = null; 
            return str;
        };
        const dataToSave = JSON.parse(simpleStringify(data));
        await setDoc(dbRef, { reportData: dataToSave });
    }, [dbRef]);

    // 데이터 로드
    const loadDataFromFirestore = useCallback(async (docRef) => {
        if (!docRef) { 
            setInitialLoading(false);
            return;
        }
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const loaded = docSnap.data().reportData;
                if (loaded && typeof loaded === 'object' && Object.keys(loaded).length > 0) {
                    setTestData(loaded);
                    // ⭐️⭐️⭐️ 변경된 부분 ⭐️⭐️⭐️
                    // setCurrentPage('page3') 로직 제거
                    // ⭐️⭐️⭐️ 변경 완료 ⭐️⭐️⭐️
                }
            }
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            setErrorMessage("데이터 로드 중 오류 발생: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    }, [setTestData, setInitialLoading, setErrorMessage]); // ⭐️ setCurrentPage 의존성 제거

    // Firebase 초기화 및 인증 Effect
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    const newDbRef = getReportDocRef(firestoreDb, firebaseAuth, user.uid);
                    setDbRef(newDbRef);
                    await loadDataFromFirestore(newDbRef); 
                } else {
                    setInitialLoading(true); 
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    } catch (error) {
                        setAuthError(error.message);
                        setInitialLoading(false);
                    }
                }
            });
            return () => unsubscribe();
        } catch (e) {
            setAuthError(e.message);
            setInitialLoading(false);
        }
    }, [loadDataFromFirestore, setInitialLoading]); 

    return { db, auth, userId, dbRef, authError, saveDataToFirestore };
};