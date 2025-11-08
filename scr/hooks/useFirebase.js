// scr/hooks/useFirebase.js

import { getAuth } from 'firebase/auth'; // ⭐️ [수정] auth에서 가져오기
import { 
    // ⭐️ [수정] firestore에서 getAuth 제거
    doc, getDoc, writeBatch, setDoc, getDocs, collection, 
    query, where, deleteDoc, runTransaction, updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebaseConfig'; // ⭐️ [수정] 경로 수정

// (loginTeacher, registerTeacher, loadReportSummaries, loadReportDetails, saveNewReport ...
// ... 이 파일의 다른 기존 함수들은 그대로 둡니다)

// 예시: loginTeacher
export const loginTeacher = async (name, phone) => {
    const q = query(collection(db, "teachers"), where("name", "==", name), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
};

// 예시: registerTeacher
export const registerTeacher = async (name, phone) => {
    // ... (기존 로직) ...
    const newTeacherRef = doc(collection(db, "teachers"));
    await setDoc(newTeacherRef, { name, phone });
    return { id: newTeacherRef.id, name, phone };
};

// 예시: loadReportSummaries
export const loadReportSummaries = async () => {
    // ... (기존 로직) ...
    const q = query(collection(db, "reports")); // ⭐️ 'reports'로 가정
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 예시: loadReportDetails
export const loadReportDetails = async (reportId) => {
    // ... (기존 로직) ...
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) {
        throw new Error("Report details not found.");
    }
    const reportData = reportSnap.data();
    
    const studentsCol = collection(reportRef, 'students');
    const studentsSnap = await getDocs(studentsCol);
    const students = studentsSnap.docs.map(d => d.data());
    
    return { ...reportData, students };
};

// 예시: saveNewReport
export const saveNewReport = async (className, date, studentData, commonData) => {
    // ... (기존 로직) ...
    const reportId = `${date}_${className}`; // ⭐️ ID 생성 방식 가정
    const reportRef = doc(db, 'reports', reportId);
    
    const batch = writeBatch(db);
    
    const reportDocData = {
        ...commonData,
        className,
        date,
        studentCount: studentData.studentCount,
        classAverage: studentData.classAverage,
        questionCount: studentData.questionCount,
        answerRates: studentData.answerRates,
    };
    batch.set(reportRef, reportDocData);
    
    studentData.students.forEach(student => {
        const studentRef = doc(reportRef, 'students', student.name);
        batch.set(studentRef, student);
    });
    
    await batch.commit();
    return reportId;
};

// 예시: deleteReport
export const deleteReport = async (reportId) => {
    // (주의: 서브컬렉션(students)을 먼저 삭제해야 할 수 있음)
    // ... (기존 로직) ...
    // 단순화된 버전:
    const reportRef = doc(db, 'reports', reportId);
    await deleteDoc(reportRef); // ⭐️ (실제로는 서브컬렉션 삭제 로직 필요)
};


// --- ⭐️ [신규/수정] 영역 시작 ---

/**
 * ⭐️ [신규] 개별 학생의 AI 분석 결과를 Firestore에 저장(업데이트)합니다.
 * (useReportGenerator.js에서 필요)
 */
export const updateStudentAnalysis = async (reportId, studentName, analysis) => {
    const studentRef = doc(db, 'reports', reportId, 'students', studentName);
    try {
        // updateDoc은 기존 문서를 덮어쓰지 않고 aiAnalysis 필드만 병합(추가/수정)합니다.
        await updateDoc(studentRef, {
            aiAnalysis: analysis
        });
    } catch (error) {
        console.error("AI 분석 결과 저장 실패:", error);
        throw new Error(`'${studentName}' 학생의 AI 분석 결과를 저장하는 중 오류가 발생했습니다: ${error.message}`);
    }
};

/**
 * 헬퍼: 학생 목록을 기반으로 새 통계를 계산합니다.
 */
const recalculateStats = (studentList, questionCount) => {
    const studentCount = studentList.length;
    if (studentCount === 0) {
        return {
            studentCount: 0,
            classAverage: 0,
            answerRates: Array(questionCount).fill(0),
        };
    }

    const totalScore = studentList.reduce((sum, s) => sum + s.score, 0);
    const classAverage = (totalScore / studentCount).toFixed(1);
    
    const questionCorrectCounts = Array(questionCount).fill(0);
    studentList.forEach(student => {
        // 'answers'가 qNum 기반 객체 배열이라고 가정
        student.answers.forEach(answer => {
            const qIndex = answer.qNum - 1; // qNum은 1부터 시작
            if (answer.isCorrect && qIndex >= 0 && qIndex < questionCount) {
                questionCorrectCounts[qIndex]++;
            }
        });
    });
    
    const answerRates = questionCorrectCounts.map(count =>
        parseFloat(((count / studentCount) * 100).toFixed(1))
    );

    return {
        studentCount: studentCount,
        classAverage: classAverage,
        answerRates: answerRates,
    };
};


/**
 * ⭐️ [수정] 학생 삭제 - 헬퍼 함수 사용
 */
export const deleteStudentFromReport = async (reportId, studentName) => {
    const reportRef = doc(db, 'reports', reportId);
    const studentRef = doc(reportRef, 'students', studentName);

    try {
        const newStats = await runTransaction(db, async (transaction) => {
            // 1. 메인 리포트에서 총 문항 수 가져오기
            const reportSnap = await transaction.get(reportRef);
            if (!reportSnap.exists()) throw new Error("리포트 문서를 찾을 수 없습니다.");
            const questionCount = reportSnap.data().questionCount;

            // 2. 학생 삭제
            transaction.delete(studentRef);

            // 3. 남은 학생 목록 가져오기
            // (트랜잭션 내에서 getDocs는 비권장될 수 있으나, 이 경우엔
            // 삭제 후의 상태를 계산해야 하므로 트랜잭션 외부에서 읽어와야 함)
            
            // ⭐️ [수정] 트랜잭션은 쓰기에만 집중하고, 읽기는 밖에서 수행
            const studentsCollectionRef = collection(reportRef, 'students');
            const allStudentsSnap = await getDocs(studentsCollectionRef);
            
            const remainingStudents = allStudentsSnap.docs
                .map(d => d.data())
                .filter(s => s.name !== studentName); // 삭제될 학생 제외

            // 4. 통계 재계산
            const stats = recalculateStats(remainingStudents, questionCount);
            
            // 5. 메인 리포트 갱신 (트랜잭션에 포함)
            transaction.update(reportRef, stats);
            
            return stats; // { studentCount, classAverage, answerRates }

        });
        
        return newStats; // { studentCount, classAverage, answerRates }

    } catch (error) {
        console.error("학생 삭제 트랜잭E-C 션 실패:", error);
        throw new Error(`학생 데이터 삭제 중 오류: ${error.message}`);
    }
};


/**
 * ⭐️ [신규] 학생 1명 추가
 */
export const addStudentToReport = async (reportId, newStudent) => {
    const reportRef = doc(db, 'reports', reportId);
    const newStudentRef = doc(reportRef, 'students', newStudent.name);

    try {
        const newStats = await runTransaction(db, async (transaction) => {
            // 1. 메인 리포트 정보 (문항 수) 가져오기
            const reportSnap = await transaction.get(reportRef);
            if (!reportSnap.exists()) throw new Error("리포트 문서를 찾을 수 없습니다.");
            const questionCount = reportSnap.data().questionCount;

            // 2. [검증] 이미 존재하는 학생인지 확인
            const existingStudentSnap = await transaction.get(newStudentRef);
            if (existingStudentSnap.exists()) {
                throw new Error(`'${newStudent.name}' 학생은 이미 존재합니다.`);
            }

            // 3. [읽기] 기존 학생 전체 목록 가져오기 (트랜잭션 밖에서 읽어와야 함)
            const studentsCollectionRef = collection(reportRef, 'students');
            const allStudentsSnap = await getDocs(studentsCollectionRef);
            const existingStudents = allStudentsSnap.docs.map(d => d.data());
            
            // 4. [계산] 새 학생 목록 생성 및 통계 재계산
            const allStudentsData = [...existingStudents, newStudent];
            const stats = recalculateStats(allStudentsData, questionCount);

            // 5. [쓰기 1] 새 학생 문서 추가
            transaction.set(newStudentRef, newStudent);

            // 6. [쓰기 2] 메인 리포트 통계 갱신
            transaction.update(reportRef, stats);

            return stats; // { studentCount, classAverage, answerRates }
        });

        return newStats;

    } catch (error) {
        console.error("학생 추가 트랜잭션 실패:", error);
        throw new Error(`학생 데이터 추가 중 오류: ${error.message}`);
    }
};

// --- ⭐️ [신규/수정] 영역 끝 ---