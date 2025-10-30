import React, { useState, useEffect, useRef, useCallback } from 'react';

// Firebase SDK
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// ⭐️ [분리된 모듈] 파일 파싱 로직
import { pairFiles, parseCSV, parseXLSX, parsePDF, processStudentData } from './lib/fileParser.js';

// ⭐️ [분리된 모듈] AI 분석 로직
import { getAIAnalysis, getOverallAIAnalysis, getQuestionUnitMapping } from './lib/ai.js';

// ⭐️ [분리된 모듈] 리포트 HTML 및 차트 생성 로직
import { 
    generateOverallReportHTML, 
    generateIndividualReportHTML, 
    renderScoreChart 
} from './lib/reportUtils.js';

// npm으로 설치한 라이브러리들
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
// Chart.js는 reportUtils에서 import하므로 여기서는 필요 없습니다.

// 아이콘
import { Home, ArrowLeft, UploadCloud, FileText } from 'lucide-react';


// --- Firebase Configuration ---
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

// --- Firestore 경로 헬퍼 ---
const getReportDocRef = (db, auth, userId) => {
    if (!userId) return null;
    return doc(db, `artifacts/${appId}/users/${userId}/reports/allData`);
};


// --- 메인 App 컴포넌트 ---
const App = () => {
    // --- React State 정의 ---
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [dbRef, setDbRef] = useState(null);
    const [authError, setAuthError] = useState(null);
    
    // data: testData
    const [testData, setTestData] = useState({});
    const [textbookText, setTextbookText] = useState('');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedStudent, setSelectedStudent] = useState(null); // null = 반 전체

    // UI State
    const [currentPage, setCurrentPage] = useState('page1');
    const [initialLoading, setInitialLoading] = useState(true);
    const [processing, setProcessing] = useState(false); // 파일 처리 중
    const [aiLoading, setAiLoading] = useState(false); // AI 분석 중
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    
    // Report State
    const [activeChart, setActiveChart] = useState(null);
    const [reportCurrentPage, setReportCurrentPage] = useState(1);
    const [reportHTML, setReportHTML] = useState(''); // 생성된 HTML 저장

    // DOM 참조
    const fileInputRef = useRef(null);
    const reportContentRef = useRef(null);
    
    // --- Firebase 함수 (React State 사용) ---
    const saveDataToFirestore = useCallback(async (data) => {
        if (!dbRef) {
            console.error("Firestore not initialized for saving.");
            return;
        }
        try {
            // 순환 참조 방지
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
            console.log("Data saved to Firestore.");
        } catch (error) {
            console.error("Error saving data to Firestore:", error);
            setErrorMessage("데이터 저장 중 오류 발생: " + error.message);
        }
    }, [dbRef]);

    const loadDataFromFirestore = useCallback(async () => {
        if (!dbRef) {
            console.error("Firestore not initialized for loading.");
            return null;
        }
        try {
            const docSnap = await getDoc(dbRef);
            if (docSnap.exists()) {
                console.log("Data loaded from Firestore.");
                const loaded = docSnap.data().reportData;
                if (loaded && typeof loaded === 'object' && Object.keys(loaded).length > 0) {
                    return loaded;
                } else {
                    console.log("Firestore data exists but is empty or invalid.");
                    return null;
                }
            } else {
                console.log("No previous data found in Firestore.");
                return null;
            }
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            setErrorMessage("데이터 로드 중 오류 발생: " + error.message);
            return null;
        }
    }, [dbRef]);

    const clearFirestoreData = useCallback(async () => {
         if (!dbRef) {
            console.error("Firestore not initialized for clearing.");
            return;
        }
         try {
            await deleteDoc(dbRef);
            console.log("Firestore data cleared.");
        } catch (error) {
            console.error("Error clearing Firestore data:", error);
            setErrorMessage("데이터 초기화 중 오류 발생: " + error.message);
        }
    }, [dbRef]);

    // --- 1. Firebase 초기화 및 인증 Effect ---
    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length === 0) {
                setErrorMessage('경고: Firebase 설정이 누락되었습니다.');
                setInitialLoading(false);
                return;
            }
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setDbRef(getReportDocRef(firestoreDb, firebaseAuth, user.uid)); 
                    console.log("User signed in with ID:", user.uid);
                } else {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(firebaseAuth, initialAuthToken);
                        } else {
                            await signInAnonymously(firebaseAuth);
                        }
                    } catch (error) {
                        console.error("Firebase Authentication failed.", error);
                        setAuthError(error.message);
                        setErrorMessage('인증 실패: ' + error.message);
                        setInitialLoading(false);
                    }
                }
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setErrorMessage('Firebase 초기화 중 오류 발생');
            setAuthError(e.message);
            setInitialLoading(false);
        }
    }, []); 

    // --- 2. 초기 데이터 로드 Effect ---
    useEffect(() => {
        if (!dbRef) return; 

        const loadInitialData = async () => {
            const loadedData = await loadDataFromFirestore();
            if (loadedData && typeof loadedData === 'object' && Object.keys(loadedData).length > 0) {
                console.log("Loaded data:", loadedData);
                setTestData(loadedData);
                setCurrentPage('page2');
            } else {
                setCurrentPage('page1');
            }
            setInitialLoading(false);
        };
        
        loadInitialData();
    }, [dbRef, loadDataFromFirestore]); 

    // --- 3. AI 분석 및 리포트 렌더링 Effect ---
    useEffect(() => {
        // 페이지5가 아니면 실행 안함
        if (currentPage !== 'page5') return;
        
        const renderReport = async () => {
            setAiLoading(true); 
            setReportHTML(`<div class="card p-8 text-center"><div class="spinner"></div><p class="mt-2 text-gray-600">AI 리포트를 생성 중입니다. 잠시만 기다려주세요...</p></div>`);
            
            let newTestData = JSON.parse(JSON.stringify(testData));
            let currentData = newTestData[selectedClass]?.[selectedDate];

            if (!currentData) {
                setErrorMessage('선택한 리포트 데이터를 찾을 수 없습니다.');
                setCurrentPage('page4');
                setAiLoading(false);
                return;
            }

            const analysisPromises = [];
            let aiOverallAnalysisFetched = false;
            let questionUnitMapFetched = false;
            let studentAiAnalysisFetched = false;

            // [캐시 확인 로직]
            if (!currentData.aiOverallAnalysis) {
                analysisPromises.push(
                    // ⭐️ 분리된 ai.js의 함수 사용
                    getOverallAIAnalysis(currentData) 
                        .then(res => { if(res) { currentData.aiOverallAnalysis = res; aiOverallAnalysisFetched = true; } })
                        .catch(err => console.error("Error fetching Overall AI Analysis:", err))
                );
            }
            if (!currentData.questionUnitMap) {
                analysisPromises.push(
                    // ⭐️ 분리된 ai.js의 함수 사용
                    getQuestionUnitMapping(currentData)
                        .then(res => { if(res) { currentData.questionUnitMap = res; questionUnitMapFetched = true; } })
                        .catch(err => console.error("Error fetching Question Unit Map:", err))
                );
            }

            let student;
            if (selectedStudent) {
                student = currentData.studentData?.students?.find(s => s.name === selectedStudent);
                if (student && student.submitted && !student.aiAnalysis) {
                    analysisPromises.push(
                        // ⭐️ 분리된 ai.js의 함수 사용 (selectedClass 전달)
                        getAIAnalysis(student, currentData, selectedClass) 
                            .then(res => { if(res) { student.aiAnalysis = res; studentAiAnalysisFetched = true; } })
                            .catch(err => console.error(`Error fetching AI Analysis for ${selectedStudent}:`, err))
                    );
                }
            }
            
            // AI 호출 실행
            try {
                await Promise.all(analysisPromises);
                
                // [캐시 저장 로직]
                if (aiOverallAnalysisFetched || questionUnitMapFetched || studentAiAnalysisFetched) {
                    setTestData(newTestData); 
                    await saveDataToFirestore(newTestData); 
                }
            } catch (error) {
                console.error("An error occurred during AI analysis Promise.all:", error);
                setErrorMessage('AI 분석 중 예기치 않은 오류가 발생했습니다.');
            }

            // 렌더링
            let finalHtml = '';
            if (selectedStudent) {
                if (!student) {
                    setErrorMessage(`학생 '${selectedStudent}' 데이터를 찾을 수 없습니다.`);
                    setCurrentPage('page4');
                    setAiLoading(false);
                    return;
                }
                // ⭐️ 분리된 reportUtils.js의 함수 사용
                finalHtml = generateIndividualReportHTML(student, currentData, student.aiAnalysis || null, currentData.aiOverallAnalysis || null, selectedClass, selectedDate);
            } else {
                // ⭐️ 분리된 reportUtils.js의 함수 사용
                finalHtml = generateOverallReportHTML(currentData, currentData.aiOverallAnalysis || null, selectedClass, selectedDate);
            }
            setReportHTML(finalHtml);
            setReportCurrentPage(1); 
            setAiLoading(false); 
        };

        renderReport();
        
    }, [currentPage, selectedClass, selectedDate, selectedStudent, saveDataToFirestore]); // testData 의존성 제거

    // --- 4. 차트 렌더링 Effect ---
    useEffect(() => {
        if (currentPage === 'page5' && !aiLoading && reportHTML) {
            const chartCanvas = document.getElementById('scoreChart');
            const data = testData[selectedClass]?.[selectedDate];
            
            if (chartCanvas && data?.studentData) {
                if (activeChart) activeChart.destroy();
                const studentForChart = data.studentData.students.find(s => s.name === selectedStudent) || null;
                // ⭐️ 분리된 reportUtils.js의 함수 사용
                const newChart = renderScoreChart(chartCanvas, data.studentData, studentForChart);
                setActiveChart(newChart);
            }
        }
        
        return () => {
            if (activeChart) {
                activeChart.destroy();
                setActiveChart(null);
            }
        };
    }, [currentPage, aiLoading, reportHTML, selectedStudent, selectedClass, selectedDate, testData]);


    // --- 5. 페이지네이션 Effect ---
    useEffect(() => {
        if (currentPage !== 'page5' || !reportContentRef.current || aiLoading) return;

        const pages = reportContentRef.current.querySelectorAll('.report-page');
        const indicator = document.getElementById('pageIndicator');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const controls = document.getElementById('pagination-controls');

        if (!indicator || !prevBtn || !nextBtn || !controls) return;

        const updateView = (pageIndex) => {
            pages.forEach((page, index) => {
                page.style.display = (index === pageIndex - 1) ? 'block' : 'none';
            });
            indicator.textContent = `${pageIndex} / ${pages.length}`;
            prevBtn.disabled = pageIndex === 1;
            nextBtn.disabled = pageIndex === pages.length;
            controls.style.display = pages.length > 1 ? 'flex' : 'none';
        };
        
        updateView(reportCurrentPage);

        const onPrev = () => setReportCurrentPage(p => (p > 1 ? p - 1 : p));
        const onNext = () => setReportCurrentPage(p => (p < pages.length ? p + 1 : p));

        prevBtn.onclick = onPrev;
        nextBtn.onclick = onNext;

        return () => {
            prevBtn.onclick = null;
            nextBtn.onclick = null;
        };
    }, [currentPage, reportCurrentPage, reportHTML, aiLoading]); 
    
    // --- 6. PDF 저장 Effect ---
    useEffect(() => {
        const handlePdfSave = async (e) => {
            if (e.target && e.target.id === 'savePdfBtn') {
                if (!activeChart) {
                    console.warn("Chart is not ready for PDF save.");
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (!activeChart) {
                         setErrorMessage('차트가 렌더링되지 않아 PDF를 저장할 수 없습니다.');
                         return;
                    }
                }

                const pdf = new jsPDF('p', 'mm', 'a4');
                const button = e.target;
                const reportType = button.dataset.reportType;
                const studentName = button.dataset.studentName;
                
                button.textContent = '저장 중...';
                button.disabled = true;

                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.left = '-9999px';
                tempContainer.style.width = '1000px'; 
                tempContainer.style.backgroundColor = 'white';
                document.body.appendChild(tempContainer);

                const addElementToPdfPage = async (element, isFirstPage = false) => {
                    if (!element) return;
                    tempContainer.innerHTML = '';
                    const contentWrapper = document.createElement('div');
                    contentWrapper.className = 'p-8 bg-white';
                    const clonedElement = element.cloneNode(true);
                    
                    const chartCanvas = clonedElement.querySelector('canvas#scoreChart');
                    if (chartCanvas && activeChart) {
                        const chartImg = new Image();
                        chartImg.src = activeChart.toBase64Image('image/png', 1.0);
                        try { await chartImg.decode(); } catch(e) { console.error("Chart image decode error:", e);}
                        chartCanvas.parentNode.replaceChild(chartImg, chartCanvas);
                    } else if (chartCanvas) {
                        const placeholder = document.createElement('div');
                        placeholder.textContent = '차트 데이터 없음';
                        placeholder.style.cssText = 'text-align: center; padding: 50px;';
                        chartCanvas.parentNode.replaceChild(placeholder, chartCanvas);
                    }

                    const commentTextArea = clonedElement.querySelector('textarea#instructorComment');
                    if (commentTextArea) {
                        const currentCommentText = document.getElementById('instructorComment')?.value ?? '';
                        const commentParagraph = document.createElement('p');
                        commentParagraph.className = 'text-sky-700 whitespace-pre-wrap p-2 border border-sky-300 rounded-lg';
                        commentParagraph.textContent = currentCommentText || " ";
                        commentTextArea.parentNode.replaceChild(commentParagraph, commentTextArea);
                    }

                    contentWrapper.appendChild(clonedElement);
                    tempContainer.appendChild(contentWrapper);

                    try {
                        const canvas = await html2canvas(tempContainer, { scale: 2, useCORS: true, logging: false });
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();
                        const imgProps = pdf.getImageProperties(imgData);
                        const ratio = imgProps.width / imgProps.height;
                        let imgHeight = pdfWidth / ratio;
                        let finalWidth = pdfWidth;
                        let finalHeight = imgHeight;
                        
                        if (imgHeight > pdfHeight) {
                            finalHeight = pdfHeight;
                            finalWidth = pdfHeight * ratio;
                        }

                        if (!isFirstPage) pdf.addPage();
                        const xOffset = (pdfWidth - finalWidth) / 2;
                        pdf.addImage(imgData, 'JPEG', xOffset, 0, finalWidth, finalHeight);
                    } catch (canvasError) {
                        console.error("html2canvas error:", canvasError);
                        throw new Error("리포트 섹션 이미지 변환 중 오류 발생");
                    }
                }; // End addElementToPdfPage

                try {
                    const sectionFeatures = document.getElementById('pdf-section-features');
                    const sectionComment = document.getElementById('pdf-section-comment');
                    const sectionAi = document.getElementById('pdf-section-ai');
                    const sectionErrata = document.getElementById('pdf-section-errata');
                    const sectionSolutions = document.getElementById('pdf-section-solutions');
                    const sectionAiOverall = document.getElementById('pdf-section-ai-overall');
                    const sectionSolutionsOverall = document.getElementById('pdf-section-solutions-overall');

                    if (reportType === 'individual') {
                        const page1Container = document.createElement('div');
                        page1Container.innerHTML = `<div class="text-center mb-4 pt-4"><p class="text-3xl font-bold text-gray-800">${selectedDate} Weekly Test</p><h2 class="text-xl text-gray-600 mt-2">${selectedClass} / ${studentName}</h2></div>`;
                        if (sectionFeatures) page1Container.appendChild(sectionFeatures.cloneNode(true));
                        if (sectionComment) page1Container.appendChild(sectionComment.cloneNode(true));
                        await addElementToPdfPage(page1Container, true);

                        if (sectionAi) await addElementToPdfPage(sectionAi);
                        if (sectionErrata) await addElementToPdfPage(sectionErrata);
                        if (sectionSolutions) await addElementToPdfPage(sectionSolutions);

                    } else { // 'overall'
                        const page1Container = document.createElement('div');
                        page1Container.innerHTML = `<div class="text-center mb-4 pt-4"><p class="text-3xl font-bold text-gray-800">${selectedDate} Weekly Test</p><h2 class="text-xl text-gray-600 mt-2">${selectedClass} / 반 전체 리포트</h2></div>`;
                        if (sectionFeatures) page1Container.appendChild(sectionFeatures.cloneNode(true));
                        await addElementToPdfPage(page1Container, true);
                        
                        if (sectionAiOverall) await addElementToPdfPage(sectionAiOverall);
                        if (sectionSolutionsOverall) await addElementToPdfPage(sectionSolutionsOverall);
                    }
                    const fileName = reportType === 'individual' ? `${selectedClass}_${selectedDate}_${studentName}_리포트.pdf` : `${selectedClass}_${selectedDate}_반전체_리포트.pdf`;
                    pdf.save(fileName);
                } catch (error) {
                    console.error("PDF 생성 오류:", error);
                    setErrorMessage(`PDF 생성 중 오류가 발생했습니다: ${error.message}.`);
                } finally {
                    if(document.body.contains(tempContainer)) {
                        document.body.removeChild(tempContainer);
                    }
                    button.textContent = '📄 PDF로 저장';
                    button.disabled = false;
                }
            }
        };

        document.body.addEventListener('click', handlePdfSave);
        return () => document.body.removeEventListener('click', handlePdfSave);
    }, [activeChart, selectedClass, selectedDate, selectedStudent]);
    

    // --- 파일 처리 로직 (React 핸들러) ---
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setSelectedFiles(files);
        setErrorMessage('');
    };

    const handleFileProcess = async () => {
        setProcessing(true);
        setErrorMessage('');

        if (selectedFiles.length === 0) {
            setErrorMessage('파일을 선택해주세요.');
            setProcessing(false);
            return;
        }

        const pairedFiles = pairFiles(selectedFiles);
        
        if (Object.keys(pairedFiles).length === 0) {
            setErrorMessage('올바르게 페어링된 PDF와 CSV/XLSX 파일이 없습니다. 파일 이름을 확인해주세요 (예: 고급수학 8월15일.pdf, 고급수학 8월15일.csv).');
            setProcessing(false);
            return;
        }

        let newTestData = JSON.parse(JSON.stringify(testData)); 
        let successCount = 0;
        let errorMessages = [];

        const pairedPdfFiles = Object.values(pairedFiles).map(p => p.pdf).filter(Boolean);
        const textbookFile = selectedFiles.find(f => f.type === 'application/pdf' && !pairedPdfFiles.includes(f));
        
        const textbookPromise = textbookFile ? parsePDF(textbookFile) : Promise.resolve('');

        const processingPromises = Object.keys(pairedFiles).map(async (key) => {
            const pair = pairedFiles[key];
            if (pair.spreadsheet && pair.pdf) {
                try {
                    const [className, date] = key.split('_');
                    let spreadsheetPromise;
                    const extension = pair.spreadsheet.name.split('.').pop()?.toLowerCase();
                    if (extension === 'xlsx') {
                        spreadsheetPromise = parseXLSX(pair.spreadsheet);
                    } else if (extension === 'csv') {
                        spreadsheetPromise = parseCSV(pair.spreadsheet);
                    } else {
                         throw new Error(`지원하지 않는 스프레드시트 형식입니다: ${pair.spreadsheet.name}`);
                    }
                    const pdfPromise = parsePDF(pair.pdf);
                    const [spreadsheetData, pdfText] = await Promise.all([spreadsheetPromise, pdfPromise]);

                    if (!spreadsheetData || !pdfText) {
                         throw new Error(`파일 파싱에 실패했습니다: ${pair.spreadsheet.name} 또는 ${pair.pdf.name}`);
                    }
                    
                    const existingData = testData[className]?.[date];
                    const newData = {
                        pdfInfo: { fullText: pdfText },
                        studentData: processStudentData(spreadsheetData)
                    };
                    
                    if (existingData?.aiOverallAnalysis) {
                        newData.aiOverallAnalysis = existingData.aiOverallAnalysis;
                    }
                    if (existingData?.questionUnitMap) {
                        newData.questionUnitMap = existingData.questionUnitMap;
                    }
                    if (existingData?.studentData?.students) {
                        newData.studentData.students.forEach(newStudent => {
                            const oldStudent = existingData.studentData.students.find(s => s.name === newStudent.name);
                            if (oldStudent?.aiAnalysis) {
                                newStudent.aiAnalysis = oldStudent.aiAnalysis;
                            }
                        });
                    }

                    return {
                        key: key, className, date,
                        data: newData 
                    };
                } catch (error) {
                    console.error(`Error processing pair ${key}:`, error);
                    errorMessages.push(`파일 '${pair.spreadsheet?.name || '?'}'/'${pair.pdf?.name || '?'}' 처리 중 오류: ${error.message}`);
                    return null;
                }
            }
            return null;
        });

        try {
            const allResults = await Promise.all([textbookPromise, ...processingPromises]);
            const textbookResult = allResults[0];
            const fileResults = allResults.slice(1);
            
            setTextbookText(textbookResult); 

            fileResults.forEach(result => {
                if (result) {
                    if (!newTestData[result.className]) { newTestData[result.className] = {}; }
                    newTestData[result.className][result.date] = result.data; 
                    successCount++;
                }
            });

            if (successCount > 0) {
                setTestData(newTestData);
                await saveDataToFirestore(newTestData); 
                setCurrentPage('page2');
            } else if (errorMessages.length === 0) {
                setErrorMessage('처리할 유효한 파일 쌍을 찾지 못했습니다.');
            }

            if (errorMessages.length > 0) {
                setErrorMessage(errorMessages.join('\n'));
            }
        } catch (parseError) {
             console.error("Error during file processing setup:", parseError);
             setErrorMessage(`파일 처리 중 오류가 발생했습니다: ${parseError.message}`);
        } finally {
            setProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; 
            setSelectedFiles([]);
        }
    };
    
    // ⭐️ [제거된 부분] HTML 생성 함수들 (reportUtils.js로 이동)
    // ⭐️ [제거된 부분] 차트 생성 함수 (reportUtils.js로 이동)

    // --- 최종 JSX 렌더링 ---
    // (index.html의 body 내용을 JSX로 변환)
    return (
        <div className="container mx-auto p-4 max-w-5xl">
            {/* --- 네비게이션 바 --- */}
            {currentPage !== 'page1' && (
                <nav id="navigation" className="fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-10 flex items-center h-16">
                    <div className="container mx-auto max-w-5xl flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <button id="navHome" className="btn btn-primary" onClick={goHome}>
                                <Home size={20} />
                                <span className="hidden sm:inline ml-2">처음으로</span>
                            </button>
                            <button id="navBack" className="btn btn-secondary" onClick={goBack}>
                                <ArrowLeft size={20} />
                                <span className="hidden sm:inline ml-2">뒤로</span>
                            </button>
                            <div className="text-sm text-gray-500 hidden sm:flex items-center">
                                {['page3', 'page4', 'page5'].includes(currentPage) && <span id="navClassName" className="font-semibold">{`> ${selectedClass}`}</span>}
                                {['page4', 'page5'].includes(currentPage) && <span id="navDateName" className="font-semibold">{`> ${selectedDate}`}</span>}
                                {currentPage === 'page5' && <span id="navReportName" className="font-semibold">{`> ${selectedStudent || '반 전체'}`}</span>}
                            </div>
                        </div>
                        <div id="navActions" className="flex-shrink-0">
                            {currentPage === 'page5' && (
                                <button 
                                    id="savePdfBtn" 
                                    data-report-type={selectedStudent ? 'individual' : 'overall'}
                                    data-student-name={selectedStudent || ''}
                                    className="btn btn-secondary btn-sm"
                                >
                                    <FileText size={16} className="mr-2" /> PDF로 저장
                                </button>
                            )}
                        </div>
                    </div>
                </nav>
            )}

            {/* --- 메인 컨텐츠 영역 --- */}
            <main className={currentPage !== 'page1' ? 'mt-16 pt-8' : ''}>
                {/* --- 페이지 1: 파일 업로드 --- */}
                <div id="page1" className={`page ${currentPage === 'page1' ? 'active' : ''}`}>
                    {initialLoading && (
                        <div id="initialLoader" className="card p-8 text-center">
                            <div className="spinner mx-auto"></div>
                            <p className="mt-2 text-gray-600">데이터베이스에서 이전 데이터를 불러오는 중입니다...</p>
                        </div>
                    )}
                    {!initialLoading && (
                        <div id="fileUploadCard" className="card">
                            <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">AI 성적 리포트 분석기</h2>
                            <p className="text-center text-gray-600 mb-6">분석할 PDF 시험지 파일과 학생 성적 데이터(CSV 또는 XLSX)를 함께 업로드해주세요.</p>
                            
                            <div className="mb-4">
                                <label htmlFor="fileInput" className="btn btn-primary w-full cursor-pointer">
                                    <UploadCloud size={20} className="mr-2" />
                                    <span>파일 선택하기</span>
                                </label>
                                <input type="file" id="fileInput" ref={fileInputRef} className="hidden" multiple accept=".pdf,.csv,.xlsx" onChange={handleFileChange} />
                            </div>

                            {selectedFiles.length > 0 && (
                                <div id="fileListContainer" className="mb-4">
                                    <h4 className="font-semibold mb-2 text-gray-600">선택된 파일:</h4>
                                    <ul id="fileList" className="list-disc list-inside bg-gray-50 p-4 rounded-lg text-sm text-gray-700 max-h-40 overflow-y-auto">
                                        {selectedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                                    </ul>
                                </div>
                            )}

                            {errorMessage && (
                                <div id="error-message" className="text-red-600 bg-red-100 p-3 rounded-lg mb-4 text-sm"
                                    dangerouslySetInnerHTML={{ __html: errorMessage.replace(/\n/g, '<br>') }} />
                            )}
                            {authError && (
                                <div className="text-red-600 bg-red-100 p-3 rounded-lg mb-4 text-sm">
                                    Firebase 인증 오류: {authError}
                                </div>
                            )}

                            <button id="processBtn" className="btn btn-primary w-full text-lg" disabled={processing || selectedFiles.length === 0} onClick={handleFileProcess}>
                                {processing && <span id="loader" className="spinner" style={{ borderColor: 'white', borderBottomColor: 'transparent', width: '20px', height: '20px', marginRight: '8px' }}></span>}
                                <span>{processing ? '분석 중...' : '분석 시작하기'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* --- 페이지 2: 반 선택 --- */}
                <div id="page2" className={`page ${currentPage === 'page2' ? 'active' : ''}`}>
                    <div className="card">
                        <h2 className="text-2xl font-bold text-center mb-6">반 선택</h2>
                        <div id="classButtons" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.keys(testData).map(className => (
                                <button
                                    key={className}
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setSelectedClass(className);
                                        showPage('page3');
                                    }}
                                >
                                    {className}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- 페이지 3: 날짜 선택 --- */}
                <div id="page3" className={`page ${currentPage === 'page3' ? 'active' : ''}`}>
                    <div className="card">
                        <h2 className="text-2xl font-bold text-center mb-6">시험 날짜 선택</h2>
                        <div id="dateButtons" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {testData[selectedClass] && Object.keys(testData[selectedClass]).map(date => (
                                <button
                                    key={date}
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setSelectedDate(date);
                                        showPage('page4');
                                    }}
                                >
                                    {date}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- 페이지 4: 리포트 선택 --- */}
                <div id="page4" className={`page ${currentPage === 'page4' ? 'active' : ''}`}>
                    <div className="card">
                        <h2 className="text-2xl font-bold text-center mb-6">리포트 선택</h2>
                        <div id="reportSelectionButtons" className="flex flex-wrap justify-center gap-3">
                            <button
                                className={`btn btn-secondary ${selectedStudent === null ? 'btn-nav-active' : ''}`}
                                onClick={() => {
                                    setSelectedStudent(null);
                                    showPage('page5');
                                }}
                            >
                                반 전체
                            </button>
                            {testData[selectedClass]?.[selectedDate]?.studentData?.students.map(student => (
                                <button
                                    key={student.name}
                                    className={`btn btn-secondary ${selectedStudent === student.name ? 'btn-nav-active' : ''}`}
                                    onClick={() => {
                                        setSelectedStudent(student.name);
                                        showPage('page5');
                                    }}
                                >
                                    {student.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- 페이지 5: 리포트 내용 --- */}
                <div id="page5" className={`page ${currentPage === 'page5' ? 'active' : ''}`}>
                    <div 
                        id="reportContent" 
                        ref={reportContentRef} 
                        className="space-y-6"
                        // ⭐️ HTML을 state에서 렌더링
                        dangerouslySetInnerHTML={{ __html: reportHTML }} 
                    />
                </div>
            </main>
        </div>
    );
};

export default App;