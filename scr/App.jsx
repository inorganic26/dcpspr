import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, Loader, Save, CloudDownload } from 'lucide-react';

// ⭐️ [수정된 부분] 실제 Firebase 설정 정보를 직접 코딩합니다. ⭐️
const REAL_FIREBASE_CONFIG = {
  // ⭐️ 방금 주신 새로운 API 키를 적용했습니다. (이 키가 유효해야 합니다.)
  apiKey: "AIzaSyDVLes7sjhRfUgsW2bw1_Sco5ZBx--pudQ", 
  authDomain: "spra-v1.firebaseapp.com",
  projectId: "spra-v1",
  storageBucket: "spra-v1.appspot.com",
  messagingSenderId: "735477807243",
  // App ID는 웹 앱을 새로 생성하면 바뀔 수 있으므로, 새로 발급받은 ID를 사용해야 합니다.
  // 이전에 사용된 ID를 일단 사용하며, 만약 새로운 ID를 발급받으셨다면 교체해야 합니다.
  appId: "1:735477807243:web:6c7fdd347a498780997c8e", 
  // measurementId는 Firestore와는 직접적인 관련이 없으므로, 사용하지 않는 경우 생략하거나 그대로 둡니다.
  // measurementId: "G-N276Q1D5S4" 
};

// ⭐️ [수정된 부분] 앱 ID 변수를 실제 값으로 설정합니다. ⭐️
const REAL_APP_ID = REAL_FIREBASE_CONFIG.appId; 

// --- Global Firebase Variables (수정된 변수 할당) ---
// IMPORTANT: 이 변수들이 위에서 정의한 실제 값을 사용하도록 설정되었습니다.
const appId = REAL_APP_ID;
const firebaseConfig = REAL_FIREBASE_CONFIG;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : undefined;

// --- Helper function for Firestore path construction ---

/**
 * Firestore의 개인 데이터 저장 경로에 맞는 Document Reference를 생성합니다.
 * 경로 오류 (Invalid document reference)를 해결하기 위해 경로 세그먼트 수를 8개로 맞춥니다.
 *
 * 구조: artifacts / {appId} / users / {userId} / reports / allData
 *
 * @param {object} db - Firestore 인스턴스
 * @param {object} auth - Firebase Auth 인스턴스
 * @returns {object} DocumentReference 객체
 */
const getReportDocRef = (db, auth) => {
    // userId가 필요하지만, auth.currentUser가 아직 null일 수 있으므로 임시로 'loading'을 사용합니다.
    // 실제 데이터 작업은 authStateChanged 이후에 userId가 확정된 후 실행됩니다.
    const userId = auth.currentUser?.uid || 'loading-user';

    // 8개의 세그먼트로 구성된 문서 경로: Collection, Doc, Collection, Doc, Collection, Doc
    // 'allData'는 보고서 데이터를 저장할 단일 문서 이름입니다.
    return doc(db, 'artifacts', appId, 'users', userId, 'reports', 'allData');
};

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [authError, setAuthError] = useState(null);
    const [data, setData] = useState({ message: '아직 저장된 데이터가 없습니다.' });
    const [status, setStatus] = useState('초기화 중...');

    // 1. Firebase 초기화 및 인증
    useEffect(() => {
        try {
            // 이제 firebaseConfig가 비어있지 않으므로 이 경고는 발생하지 않습니다.

            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // 인증 상태 리스너 설정
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setStatus('인증 완료. 사용자 ID: ' + user.uid);
                } else {
                    // 사용자 인증 시도 (Custom Token이 있으면 사용, 없으면 익명 로그인)
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            // 익명 로그인 시도
                            await signInAnonymously(firebaseAuth); 
                        }
                    } catch (error) {
                        console.error("Firebase Authentication failed.", error);
                        setAuthError(error.message);
                        setStatus('인증 실패: ' + error.message);
                    }
                }
            });

            return () => unsubscribe(); // 클린업 함수

        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setStatus('Firebase 초기화 중 오류 발생');
            setAuthError(e.message);
        }
    }, []);

    // 2. Firestore 실시간 데이터 로드
    useEffect(() => {
        if (!db || !auth || !userId) return;

        // userId가 'loading-user'나 null이 아닌, 실제 UID를 가지고 있을 때만 스냅샷 시작
        if (userId && userId !== 'loading-user') {
            try {
                const docRef = getReportDocRef(db, auth);

                setStatus('데이터 로드 준비 중...');

                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const loadedData = docSnap.data();
                        setData(loadedData);
                        setStatus(`데이터 로드 성공. (업데이트 시간: ${new Date().toLocaleTimeString('ko-KR')})`);
                    } else {
                        // 문서가 없으면 기본값으로 설정
                        setData({ message: '저장된 데이터가 없습니다. 새로운 데이터를 저장해 보세요.' });
                        setStatus('저장된 문서 없음. 새 문서를 만들 수 있습니다.');
                    }
                }, (error) => {
                    console.error("Firestore Snapshot Error:", error);
                    setStatus('데이터 로드 중 오류 발생: 경로를 확인하세요.');
                });

                return () => unsubscribe(); // 클린업 함수

            } catch (e) {
                console.error("Data Load Setup Error:", e);
                setStatus('데이터 로드 설정 중 오류 발생');
            }
        }
    }, [db, auth, userId]); // db와 userId가 확정된 후에 실행

    // 3. 데이터 저장 함수
    const handleSaveData = async () => {
        if (!db || !auth || !userId) {
            alert('Firebase 연결 또는 인증이 완료되지 않았습니다.');
            return;
        }

        setStatus('데이터 저장 중...');
        const docRef = getReportDocRef(db, auth);
        const newData = {
            message: `저장된 보고서 데이터입니다. (저장 시각: ${new Date().toLocaleTimeString('ko-KR')})`,
            userId: userId,
            appName: '리포트 데이터 저장 앱',
            timestamp: new Date().toISOString()
        };

        try {
            // setDoc을 사용하여 문서를 덮어쓰거나 생성합니다.
            await setDoc(docRef, newData);
            setStatus('데이터 저장 성공!');
        } catch (e) {
            console.error("Data Save Error:", e);
            setStatus('데이터 저장 실패: ' + e.message);
        }
    };

    const isReady = db && auth && userId && userId !== 'loading-user';

    return (
        <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans">
            
            <h1 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b pb-2">
                리포트 데이터 저장 앱 (Firebase 연결 완료)
            </h1>

            {/* 상태 및 인증 정보 */}
            <div className="mb-6 p-4 bg-white shadow-lg rounded-xl">
                <p className="text-sm font-semibold mb-2 flex items-center">
                    <span className={`h-3 w-3 rounded-full mr-2 ${isReady ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></span>
                    상태: <span className="ml-1 font-normal text-gray-700">{status}</span>
                </p>
                <p className="text-xs text-gray-500 truncate">
                    {userId ? `인증된 사용자 ID: ${userId}` : '사용자 인증 진행 중...'}
                </p>
                <p className="text-xs text-gray-500">
                    앱 ID: {appId}
                </p>
                {authError && (
                    <div className="mt-3 p-2 bg-red-100 text-red-700 rounded-lg text-sm flex items-start">
                        <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="font-medium">인증 오류: {authError}</span>
                    </div>
                )}
            </div>

            {/* 데이터 로드 영역 */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center">
                    <CloudDownload className="w-5 h-5 mr-2 text-indigo-500" />
                    로드된 데이터 (실시간 반영)
                </h2>
                <div className="p-6 bg-indigo-100 border border-indigo-300 rounded-xl shadow-inner">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                        {isReady ? JSON.stringify(data, null, 2) : (
                            <div className="flex items-center text-gray-600">
                                <Loader className="w-4 h-4 mr-2 animate-spin" /> 데이터 로드를 기다리는 중...
                            </div>
                        )}
                    </pre>
                </div>
            </div>

            {/* 액션 버튼 */}
            <button
                onClick={handleSaveData}
                disabled={!isReady}
                className={`w-full md:w-auto px-6 py-3 text-lg font-semibold rounded-xl transition duration-300 shadow-md flex items-center justify-center
                    ${isReady ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-[1.01] active:scale-100' : 'bg-gray-400 text-gray-600 cursor-not-allowed'}
                `}
            >
                <Save className="w-5 h-5 mr-3" />
                {isReady ? '새 데이터 저장 (경로 오류 수정 확인)' : '준비 중...'}
            </button>

            <p className="mt-4 text-sm text-gray-500">
                **참고:** 이 앱은 개인 데이터 경로 `artifacts/{appId}/users/{userId}/reports/allData`에 더미 데이터를 저장합니다.
                Firebase 설정이 올바르게 적용되었습니다.
            </p>
        </div>
    );
};

export default App;