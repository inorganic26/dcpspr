import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app'; // getApps, getApp import 추가
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collectionGroup, 
    query, 
    where, 
    orderBy, 
    getDocs 
} from 'firebase/firestore';
import { useReportContext } from '../context/ReportContext';

// Firebase 설정
// 🚨 이 키는 Firebase Console의 Web API Key와 일치해야 합니다. (spra-v1 auto created 키 적용)
const REAL_FIREBASE_CONFIG = {
  // 🔑 새로 발급받은 API 키로 변경
  apiKey: "AIzaSyCE4e23T5uHUg8HevbOV0Opl-upgUeIG-g", 
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

    // 데이터 저장 함수 (기존 로직 유지)
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

    // 데이터 로드 함수 (기존 로직 유지)
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
                }
            }
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            setErrorMessage("데이터 로드 중 오류 발생: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    }, [setTestData, setInitialLoading, setErrorMessage]);

    // 누적 성적 데이터 Fetching 함수 (기존 로직 유지)
    const fetchCumulativeData = useCallback(async (studentId) => {
        if (!db) {
            console.error("Firestore DB is not initialized.");
            return [];
        }
        if (!studentId) {
            console.error("Student ID is required to fetch cumulative data.");
            return [];
        }
        
        console.log(`Fetching cumulative data for student: ${studentId}`);
        
        const reportsQuery = query(
            collectionGroup(db, 'reports'), 
            where('studentId', '==', studentId), 
            orderBy('date', 'asc') 
        );
    
        try {
            const querySnapshot = await getDocs(reportsQuery);
            const cumulativeData = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.date && data.score != null && data.classAverage != null) {
                    cumulativeData.push({
                        date: data.date, 
                        studentScore: data.score,
                        classAverage: data.classAverage
                    });
                }
            });
            console.log("Fetched cumulative data:", cumulativeData);
            return cumulativeData;
    
        } catch (error) {
            console.error("Error fetching cumulative data: ", error);
            return [];
        }
    }, [db]);

    // Firebase 초기화 및 인증 Effect
    useEffect(() => {
        try {
            // ⭐️ 안전한 초기화: 이미 초기화된 앱이 있다면 그것을 사용
            const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
            
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
                        if (error.code === 'auth/network-request-failed' || error.message.includes('400')) {
                             console.error(`[FATAL FIREBASE ERROR] ${error.message}. 
                             Key Mismatch or API Restriction is the most likely cause. 
                             Check the key in REAL_FIREBASE_CONFIG against the Web API Key in Firebase Console.`);
                        }
                    }
                }
            });
            return () => unsubscribe();
        } catch (e) {
            setAuthError(e.message);
            setInitialLoading(false);
        }
    }, [loadDataFromFirestore, setInitialLoading]); 

    return { 
        db, 
        auth, 
        userId, 
        dbRef, 
        authError, 
        saveDataToFirestore,
        fetchCumulativeData
    };
};