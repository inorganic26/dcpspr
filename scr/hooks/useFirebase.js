// 📄 scr/hooks/useFirebase.js (수정된 전체 코드)
import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
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

// ✅ Firebase 설정 (spra-v1 기준)
const REAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCE4e23T5uHUg8HevbOV0Opl-upgUeIG-g",
  authDomain: "spra-v1.firebaseapp.com",
  projectId: "spra-v1",
  storageBucket: "spra-v1.firebasestorage.app", 
  messagingSenderId: "735477807243",
  appId: "1:735477807243:web:6c7fdd347a498780997c8e"
};

const appId = REAL_FIREBASE_CONFIG.appId;
const firebaseConfig = REAL_FIREBASE_CONFIG;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

// 🔗 Firestore 문서 참조 경로 생성 함수
const getReportDocRef = (db, userId) => {
  if (!userId) return null;
  return doc(db, `artifacts/${appId}/users/${userId}/reports/allData`);
};

export const useFirebase = () => {
  const { setTestData, setInitialLoading, setErrorMessage } = useReportContext();
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [dbRef, setDbRef] = useState(null);
  const [authError, setAuthError] = useState(null);

  // ✅ Firestore 저장
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

  // ✅ Firestore 로드
  const loadDataFromFirestore = useCallback(async (docRef) => {
    if (!docRef) { 
      // docRef가 없으면 로딩 해제 후 종료
      setInitialLoading(false);
      return;
    }
    try {
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const loaded = docSnap.data().reportData;
        // 데이터가 유효할 경우에만 setTestData 호출
        if (loaded && typeof loaded === 'object' && Object.keys(loaded).length > 0) {
          setTestData(loaded);
        } else {
           // 문서에 데이터는 있지만 구조가 비어있다면 빈 객체로 초기화
           setTestData({}); 
        }
      } else {
        // 문서 자체가 없다면 빈 객체로 초기화
        setTestData({}); 
      }
      setAuthError(null);
    } catch (error) {
      console.error("Error loading data from Firestore:", error);
      setErrorMessage("데이터 로드 중 오류 발생: " + (error.message.includes('permission-denied') ? "Firestore 접근 권한이 없습니다. 보안 규칙을 확인해주세요." : error.message));
      setAuthError(error.message);
      setTestData({});
    } finally {
      // ⭐️⭐️⭐️ 중요 수정: 어떤 경우에도 로딩을 해제합니다. ⭐️⭐️⭐️
      setInitialLoading(false); 
    }
  }, [setTestData, setInitialLoading, setErrorMessage]);

  // ✅ 누적 성적 데이터 조회 (기존 로직 유지)
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

  // ✅ Firebase 초기화 및 로그인
  useEffect(() => {
    try {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          console.log("[Auth] Logged in:", user.uid);
          setUserId(user.uid);
          const newDbRef = getReportDocRef(firestoreDb, user.uid);
          setDbRef(newDbRef);
          
          // ⭐️ 인증 후 데이터 로드 시작 전에 로딩 상태를 true로 설정
          setInitialLoading(true); 
          await loadDataFromFirestore(newDbRef);
          
        } else {
          setInitialLoading(true); // 비인증 시도 전 로딩 시작
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (error) {
            console.error("[Auth Error]", error);
            setAuthError(error.message);
            setInitialLoading(false); // 인증 실패 시 로딩 해제
            if (error.code === 'auth/network-request-failed' || error.message.includes('400')) {
              console.error(`[FATAL FIREBASE ERROR] ${error.message}
              🔑 Key mismatch or API restriction suspected.
              Check the key in REAL_FIREBASE_CONFIG against Firebase Console.`);
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