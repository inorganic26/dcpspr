// scr/hooks/useFirebase.js

import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig'; // (firebaseConfig.js 파일이 있다고 가정)

/**
 * ⭐️ [기존] 이름과 전화번호로 선생님 정보를 Firestore에서 조회 (로그인)
 * (이 함수는 변경 없음)
 */
export const loginTeacher = async (name, phone) => {
    try {
        const teachersRef = collection(db, 'teachers');
        const q = query(teachersRef, 
            where("name", "==", name), 
            where("phone", "==", phone)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log('일치하는 선생님 정보 없음');
            return null;
        }
        
        const teacherDoc = querySnapshot.docs[0];
        return { id: teacherDoc.id, ...teacherDoc.data() }; 

    } catch (error) {
        console.error("로그인 중 Firestore 오류:", error);
        throw new Error("로그인 중 오류가 발생했습니다.");
    }
};

/**
 * ⭐️ [기존] 이름과 전화번호로 새 선생님을 등록 (회원가입)
 * (이 함수는 변경 없음)
 */
export const registerTeacher = async (name, phone) => {
    try {
        const teachersRef = collection(db, 'teachers');
        
        // 1. 이미 존재하는지 확인
        const q = query(teachersRef, 
            where("name", "==", name), 
            where("phone", "==", phone)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            throw new Error("이미 동일한 정보로 등록된 사용자가 있습니다.");
        }

        // 2. 새 선생님 문서 추가
        const newTeacherDocRef = await addDoc(teachersRef, {
            name: name,
            phone: phone,
            createdAt: serverTimestamp()
        });
        
        console.log("새 선생님 등록:", newTeacherDocRef.id);
        
        // 3. 새로 생성된 정보 반환
        return { id: newTeacherDocRef.id, name: name, phone: phone };

    } catch (error) {
        console.error("등록 중 Firestore 오류:", error);
        throw error; // 오류를 App.jsx로 다시 던져서 UI에 표시
    }
};


/**
 * ⭐️ [수정] '공용' 리포트 데이터를 불러옵니다.
 * (teacherId 파라미터 제거)
 */
export const loadDataFromFirestore = async (/* teacherId 제거 */) => {
    
    // ⭐️ 'teacherReports' 대신 'academyReports'의 'sharedData' 문서를 고정으로 사용
    const docRef = doc(db, 'academyReports', 'sharedData'); 
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log("공용 데이터 로드 성공:", docSnap.data().testData);
            return docSnap.data().testData || {};
        } else {
            console.log("공용 데이터 없음. 새 데이터 생성.");
            return {};
        }
    } catch (error) {
        console.error("데이터 로드 중 Firestore 오류:", error);
        throw new Error("데이터 로드 중 오류 발생: " + error.message);
    }
};

/**
 * ⭐️ [수정] '공용' 리포트 데이터에 (병합하여) 저장합니다.
 * (teacherId 파라미터 제거)
 */
export const saveDataToFirestore = async (/* teacherId 제거 */ allAnalysedData) => {

    // ⭐️ 'teacherReports' 대신 'academyReports'의 'sharedData' 문서를 고정으로 사용
    const docRef = doc(db, 'academyReports', 'sharedData');

    try {
        // 1. (안전) 기존 '공용' 데이터를 먼저 불러옵니다.
        const docSnap = await getDoc(docRef);
        const existingTestData = docSnap.exists() ? docSnap.data().testData : {};
        
        // 2. 기존 데이터에 새로 분석된 데이터를 병합합니다.
        const newData = JSON.parse(JSON.stringify(existingTestData)); // 깊은 복사
        
        Object.keys(allAnalysedData).forEach(className => {
            const uploadDate = Object.keys(allAnalysedData[className])[0];
            if (!newData[className]) newData[className] = {};
            newData[className][uploadDate] = allAnalysedData[className][uploadDate];
        });

        // 3. 병합된 전체 testData 객체를 '공용' 문서에 다시 저장
        await setDoc(docRef, { 
            testData: newData,
            lastUpdated: serverTimestamp() 
        });
        
        console.log("공용 데이터 저장 및 병합 완료");

    } catch (error) {
        console.error("데이터 저장 중 Firestore 오류:", error);
        throw new Error("데이터 저장 중 오류 발생: " + error.message);
    }
};