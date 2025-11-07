// scr/hooks/useFirebase.js

import { 
    getFirestore, collection, query, where, getDocs, doc, getDoc, 
    setDoc, addDoc, serverTimestamp, updateDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';

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


// --- ⭐️ [수정] 데이터 로직 전체 재작성 (확장성 확보) ---

/**
 * ⭐️ [신규] 'reports' 컬렉션에서 모든 리포트의 요약 정보만 불러옵니다.
 * (학생 데이터 제외)
 */
export const loadReportSummaries = async () => {
    try {
        const summaries = [];
        const reportsRef = collection(db, 'reports');
        const querySnapshot = await getDocs(reportsRef);
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            summaries.push({
                id: doc.id, // 예: "고1A반_11월 7일"
                className: data.className,
                date: data.date,
                studentCount: data.studentCount || 0
            });
        });
        
        console.log("리포트 요약 정보 로드 성공:", summaries.length, "개");
        return summaries;
        
    } catch (error) {
        console.error("리포트 요약 로드 중 Firestore 오류:", error);
        throw new Error("리포트 요약 로드 중 오류 발생: " + error.message);
    }
};

/**
 * ⭐️ [신규] 특정 리포트 1개의 상세 데이터를 불러옵니다.
 * (공통 데이터 + 하위 컬렉션의 학생 데이터)
 */
export const loadReportDetails = async (reportId) => {
    if (!reportId) throw new Error("reportId가 필요합니다.");
    
    try {
        const reportRef = doc(db, 'reports', reportId);
        const reportSnap = await getDoc(reportRef);

        if (!reportSnap.exists()) {
            throw new Error("리포트 데이터를 찾을 수 없습니다.");
        }

        const commonData = reportSnap.data();
        
        // 하위 컬렉션(students)의 모든 문서(학생)를 가져옵니다.
        const students = [];
        const studentsRef = collection(db, 'reports', reportId, 'students');
        const studentsSnap = await getDocs(studentsRef);
        
        studentsSnap.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });

        console.log(`[${reportId}] 리포트 상세 로드 성공. (학생 ${students.length}명)`);
        
        // 공통 데이터와 학생 데이터를 합쳐서 반환
        return {
            ...commonData,
            students: students // 'studentData' 객체 대신 'students' 배열을 바로 포함
        };

    } catch (error) {
        console.error(`[${reportId}] 리포트 상세 로드 중 오류:`, error);
        throw new Error("리포트 상세 데이터 로드 중 오류 발생: " + error.message);
    }
};

/**
 * ⭐️ [수정] '공용' 저장 대신 '개별 리포트'를 원자적으로 저장합니다.
 * (파일 업로드 시 사용)
 */
export const saveNewReport = async (className, uploadDate, studentData, commonData) => {
    // 1. 고유 ID 생성
    const reportId = `${className}_${uploadDate}`; // 예: "고1A반_11월 7일"
    const reportRef = doc(db, 'reports', reportId);

    console.log(`[${reportId}] 새 리포트 저장 시작...`);

    try {
        // 2. WriteBatch를 사용하여 여러 쓰기 작업을 원자적으로 처리
        const batch = writeBatch(db);

        // 3. (작업 1) 'reports' 컬렉션에 공통 데이터 저장
        //    (studentData 객체는 제외하고 저장)
        const commonDataToSave = {
            className: className,
            date: uploadDate,
            pdfInfo: commonData.pdfInfo,
            aiOverallAnalysis: commonData.aiOverallAnalysis,
            questionUnitMap: commonData.questionUnitMap,
            // 'studentData' 객체에서 통계만 추출
            studentCount: studentData.studentCount,
            classAverage: studentData.classAverage,
            questionCount: studentData.questionCount,
            answerRates: studentData.answerRates,
            lastUpdated: serverTimestamp()
        };
        batch.set(reportRef, commonDataToSave);

        // 4. (작업 2+) 'students' 하위 컬렉션에 학생 개별 데이터 저장
        studentData.students.forEach(student => {
            const studentRef = doc(db, 'reports', reportId, 'students', student.name);
            batch.set(studentRef, student);
        });
        
        // 5. 모든 작업을 한 번에 커밋
        await batch.commit();
        
        console.log(`[${reportId}] 새 리포트 저장 완료. (학생 ${studentData.studentCount}명)`);
        return reportId; // 성공 시 reportId 반환

    } catch (error) {
        console.error(`[${reportId}] 새 리포트 저장 중 Firestore 오류:`, error);
        throw new Error("새 리포트 저장 중 오류 발생: " + error.message);
    }
};

/**
 * ⭐️ [신규] 특정 학생 1명의 AI 분석 결과만 업데이트합니다.
 * (개별 리포트 생성 시 사용)
 */
export const updateStudentAnalysis = async (reportId, studentName, analysis) => {
    if (!reportId || !studentName) throw new Error("reportId와 studentName이 필요합니다.");
    
    const studentRef = doc(db, 'reports', reportId, 'students', studentName);
    
    try {
        await updateDoc(studentRef, {
            aiAnalysis: analysis
        });
        console.log(`[${reportId}] 학생 '${studentName}'의 AI 분석 저장 완료.`);
    } catch (error) {
        console.error(`[${reportId}] 학생 '${studentName}' AI 분석 저장 오류:`, error);
        throw new Error("학생 AI 분석 결과 저장 중 오류 발생: " + error.message);
    }
};

/**
 * ⭐️ [신규] 특정 학생 1명의 데이터를 리포트에서 삭제합니다.
 */
export const deleteStudentFromReport = async (reportId, studentName) => {
    if (!reportId || !studentName) throw new Error("reportId와 studentName이 필요합니다.");
    
    const studentRef = doc(db, 'reports', reportId, 'students', studentName);
    
    try {
        await deleteDoc(studentRef);
        console.log(`[${reportId}] 학생 '${studentName}' 삭제 완료.`);
        // (참고: 반 평균 재계산은 이 함수에서 처리하지 않음)
    } catch (error) {
        console.error(`[${reportId}] 학생 '${studentName}' 삭제 오류:`, error);
        throw new Error("학생 데이터 삭제 중 오류 발생: " + error.message);
    }
};

/**
 * ⭐️ [신규] 특정 리포트 1개(하위 학생 데이터 포함)를 삭제합니다.
 */
export const deleteReport = async (reportId) => {
    if (!reportId) throw new Error("reportId가 필요합니다.");
    
    console.log(`[${reportId}] 리포트 삭제 시작...`);
    const reportRef = doc(db, 'reports', reportId);
    
    try {
        // 1. 하위 컬렉션(students)의 모든 문서를 먼저 삭제 (Batch 사용)
        const batch = writeBatch(db);
        const studentsRef = collection(db, 'reports', reportId, 'students');
        const studentsSnap = await getDocs(studentsRef);
        
        if (!studentsSnap.empty) {
            console.log(`[${reportId}] 학생 ${studentsSnap.size}명 데이터 삭제 중...`);
            studentsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        // 2. (작업 2) 상위 문서(report) 삭제
        batch.delete(reportRef);
        
        // 3. Batch 커밋
        await batch.commit();
        
        console.log(`[${reportId}] 리포트 및 하위 학생 데이터 삭제 완료.`);

    } catch (error) {
        console.error(`[${reportId}] 리포트 삭제 오류:`, error);
        throw new Error("리포트 삭제 중 오류 발생: " + error.message);
    }
};