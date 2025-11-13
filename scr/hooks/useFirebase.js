// scr/hooks/useFirebase.js

import { 
    getFirestore, collection, query, where, getDocs, doc, getDoc, 
    setDoc, addDoc, serverTimestamp, updateDoc, deleteDoc, writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';

/**
 * ⭐️ [기존] 이름과 전화번호로 선생님 정보를 Firestore에서 조회 (로그인)
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
 */
export const registerTeacher = async (name, phone) => {
    try {
        const teachersRef = collection(db, 'teachers');
        
        const q = query(teachersRef, 
            where("name", "==", name), 
            where("phone", "==", phone)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            throw new Error("이미 동일한 정보로 등록된 사용자가 있습니다.");
        }

        const newTeacherDocRef = await addDoc(teachersRef, {
            name: name,
            phone: phone,
            createdAt: serverTimestamp()
        });
        
        console.log("새 선생님 등록:", newTeacherDocRef.id);
        
        return { id: newTeacherDocRef.id, name: name, phone: phone };

    } catch (error) {
        console.error("등록 중 Firestore 오류:", error);
        throw error; 
    }
};


// --- ⭐️ [기존] 리포트 데이터 로직 (변경 없음) ---

export const loadReportSummaries = async () => {
    try {
        const summaries = [];
        const reportsRef = collection(db, 'reports');
        const querySnapshot = await getDocs(reportsRef);
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            summaries.push({
                id: doc.id, 
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

export const loadReportDetails = async (reportId) => {
    if (!reportId) throw new Error("reportId가 필요합니다.");
    
    try {
        const reportRef = doc(db, 'reports', reportId);
        const reportSnap = await getDoc(reportRef);

        if (!reportSnap.exists()) {
            throw new Error("리포트 데이터를 찾을 수 없습니다.");
        }

        const commonData = reportSnap.data();
        
        const students = [];
        const studentsRef = collection(db, 'reports', reportId, 'students');
        const studentsSnap = await getDocs(studentsRef);
        
        studentsSnap.forEach(doc => {
            students.push({ id: doc.id, ...doc.data() });
        });

        console.log(`[${reportId}] 리포트 상세 로드 성공. (학생 ${students.length}명)`);
        
        return {
            ...commonData,
            students: students 
        };

    } catch (error) {
        console.error(`[${reportId}] 리포트 상세 로드 중 오류:`, error);
        throw new Error("리포트 상세 데이터 로드 중 오류 발생: " + error.message);
    }
};

export const saveNewReport = async (className, uploadDate, studentData, commonData) => {
    const reportId = `${className}_${uploadDate}`; 
    const reportRef = doc(db, 'reports', reportId);

    console.log(`[${reportId}] 새 리포트 저장 시작...`);

    try {
        const batch = writeBatch(db);

        const commonDataToSave = {
            className: className,
            date: uploadDate,
            pdfInfo: commonData.pdfInfo,
            aiOverallAnalysis: commonData.aiOverallAnalysis,
            questionUnitMap: commonData.questionUnitMap,
            studentCount: studentData.studentCount,
            classAverage: studentData.classAverage,
            questionCount: studentData.questionCount,
            answerRates: studentData.answerRates,
            lastUpdated: serverTimestamp()
        };
        batch.set(reportRef, commonDataToSave);

        studentData.students.forEach(student => {
            const studentRef = doc(db, 'reports', reportId, 'students', student.name);
            batch.set(studentRef, student);
        });
        
        await batch.commit();
        
        console.log(`[${reportId}] 새 리포트 저장 완료. (학생 ${studentData.studentCount}명)`);
        return reportId; 

    } catch (error) {
        console.error(`[${reportId}] 새 리포트 저장 중 Firestore 오류:`, error);
        throw new Error("새 리포트 저장 중 오류 발생: " + error.message);
    }
};

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

export const recalculateReportStatistics = async (reportId) => {
    if (!reportId) throw new Error("reportId가 필요합니다.");

    console.log(`[${reportId}] 통계 재계산 시작...`);
    const reportRef = doc(db, 'reports', reportId);
    
    const reportSnap = await getDoc(reportRef);
    if (!reportSnap.exists()) {
        throw new Error("통계 재계산을 위한 리포트 문서를 찾을 수 없습니다.");
    }
    const questionCount = reportSnap.data().questionCount || 0;
    if (questionCount === 0) {
         throw new Error("통계 재계산 실패: 문항 수(questionCount)가 0입니다.");
    }

    const studentsRef = collection(db, 'reports', reportId, 'students');
    const studentsSnap = await getDocs(studentsRef);
    
    let totalScore = 0;
    const students = [];
    const questionCorrectCounts = Array(questionCount).fill(0); 

    studentsSnap.forEach(doc => {
        const student = doc.data();
        if (!student.submitted) return; 

        students.push(student);
        totalScore += student.score;

        student.answers.forEach((ans, index) => {
            if (ans.isCorrect === true && index < questionCount) {
                questionCorrectCounts[index]++;
            }
        });
    });

    const studentCount = students.length;

    const newStats = {
        studentCount: studentCount,
        classAverage: (studentCount > 0 ? (totalScore / studentCount) : 0).toFixed(1),
        answerRates: questionCorrectCounts.map(count => 
            parseFloat(((studentCount > 0 ? count / studentCount : 0) * 100).toFixed(1))
        )
    };

    try {
        await updateDoc(reportRef, {
            studentCount: newStats.studentCount,
            classAverage: newStats.classAverage,
            answerRates: newStats.answerRates,
            lastUpdated: serverTimestamp()
        });
        console.log(`[${reportId}] 통계 재계산 및 업데이트 완료.`);
        return newStats; 

    } catch (error) {
        console.error(`[${reportId}] 통계 업데이트 중 오류:`, error);
        throw new Error("통계 업데이트 중 오류 발생: " + error.message);
    }
};

export const deleteStudentFromReport = async (reportId, studentName) => {
    if (!reportId || !studentName) throw new Error("reportId와 studentName이 필요합니다.");
    
    const studentRef = doc(db, 'reports', reportId, 'students', studentName);
    
    try {
        await deleteDoc(studentRef);
        console.log(`[${reportId}] 학생 '${studentName}' 삭제 완료.`);
        
        const newStats = await recalculateReportStatistics(reportId);
        return newStats; 

    } catch (error) {
        console.error(`[${reportId}] 학생 '${studentName}' 삭제 및 재계산 오류:`, error);
        throw new Error("학생 데이터 삭제/재계산 중 오류 발생: " + error.message);
    }
};

export const deleteReport = async (reportId) => {
    if (!reportId) throw new Error("reportId가 필요합니다.");
    
    console.log(`[${reportId}] 리포트 삭제 시작...`);
    const reportRef = doc(db, 'reports', reportId);
    
    try {
        const batch = writeBatch(db);
        const studentsRef = collection(db, 'reports', reportId, 'students');
        const studentsSnap = await getDocs(studentsRef);
        
        if (!studentsSnap.empty) {
            console.log(`[${reportId}] 학생 ${studentsSnap.size}명 데이터 삭제 중...`);
            studentsSnap.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        batch.delete(reportRef);
        await batch.commit();
        
        console.log(`[${reportId}] 리포트 및 하위 학생 데이터 삭제 완료.`);

    } catch (error) {
        console.error(`[${reportId}] 리포트 삭제 오류:`, error);
        throw new Error("리포트 삭제 중 오류 발생: " + error.message);
    }
};

export const addStudentToReport = async (reportId, student) => {
    if (!reportId || !student || !student.name) {
        throw new Error("reportId와 학생 정보(이름 포함)가 필요합니다.");
    }

    const studentRef = doc(db, 'reports', reportId, 'students', student.name);

    try {
        await setDoc(studentRef, student);
        console.log(`[${reportId}] 학생 '${student.name}' 추가/업데이트 완료.`);
        
        const newStats = await recalculateReportStatistics(reportId);
        return newStats; 

    } catch (error) {
        console.error(`[${reportId}] 학생 '${student.name}' 추가 및 재계산 오류:`, error);
        throw new Error("학생 데이터 추가/재계산 중 오류 발생: " + error.message);
    }
};


// --- ⭐️ [제거] 과목 관리(Subject) 로직 ---
// export const loadSubjects = async () => { ... };
// export const saveSubject = async (subjectId, label, examplesText) => { ... };
// export const deleteSubject = async (subjectId) => { ... };