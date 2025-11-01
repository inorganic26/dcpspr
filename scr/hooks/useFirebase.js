import { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
// [수정] 누적 데이터 쿼리에 필요한 함수들 import 추가
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
    // ⚠️ 참고: 현재 모든 데이터를 이 단일 문서에 저장하고 있습니다.
    return doc(db, `artifacts/${appId}/users/${userId}/reports/allData`);
};

export const useFirebase = () => {
    const { setTestData, setCurrentPage, setInitialLoading, setErrorMessage } = useReportContext();
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [dbRef, setDbRef] = useState(null);
    const [authError, setAuthError] = useState(null);

    // 데이터 저장 (⚠️ 현재 누적 데이터와 호환되지 않는 방식)
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
        // 'allData' 문서에 모든 데이터를 덮어쓰기합니다.
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
                }
            }
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            setErrorMessage("데이터 로드 중 오류 발생: " + error.message);
        } finally {
            setInitialLoading(false);
        }
    }, [setTestData, setInitialLoading, setErrorMessage]);

    /**
     * ----------------------------------------------------------------
     * [신규] 특정 학생의 누적 성적 데이터 Fetching 함수
     * ----------------------------------------------------------------
     * ⚠️ 'db' 인스턴스에 의존하므로 hook 내부에 정의되고 반환되어야 합니다.
     */
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
    }, [db]); // 'db' state가 초기화된 후에 함수가 올바르게 작동하도록 의존성 배열에 추가

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

    // [수정] fetchCumulativeData 함수를 반환 객체에 추가
    return { 
        db, 
        auth, 
        userId, 
        dbRef, 
        authError, 
        saveDataToFirestore,
        fetchCumulativeData // ⬅️ [신규] 누적 데이터 함수 추가
    };
};