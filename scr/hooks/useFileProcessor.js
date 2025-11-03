import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
// ⚠️ 1. fileParser의 모든 함수를 가져옵니다.
import { pairFiles, parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
// ⚠️ 2. ai의 모든 분석 함수를 가져옵니다.
import { getOverallAIAnalysis, getQuestionUnitMapping, getAIAnalysis } from '../lib/ai.js'; 

/**
 * ⚠️ 헬퍼 함수: 한 개의 반(Class)에 대한 모든 AI 분석을 '일괄 병렬 처리'합니다.
 * (이 함수는 useFileProcessor 훅 외부에 정의하거나, useCallback 내부에 정의할 수 있습니다)
 */
async function processClassBatch(className, classFiles, uploadDate) {
    const { pdf, spreadsheet } = classFiles;

    // 1. 파일 파싱
    const pdfText = await parsePDF(pdf);
    const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
        await parseCSV(spreadsheet) : 
        await parseXLSX(spreadsheet);
    
    const studentData = processStudentData(spreadsheetData);
    
    // 2. 데이터 기본 구조 생성
    const dataForThisDate = {
        pdfInfo: { fileName: pdf.name, fullText: pdfText },
        studentData: studentData,
        aiOverallAnalysis: null,
        questionUnitMap: null,
    };

    console.log(`[${className}] Step 1/3: 공통 분석 (총평, 단원맵) 병렬 시작...`);
    
    // 3. [병렬 Step A] 공통 분석 2개를 먼저 병렬로 실행 (단원맵이 학생 분석에 필요)
    const [aiOverall, unitMap] = await Promise.all([
        getOverallAIAnalysis(dataForThisDate),
        getQuestionUnitMapping(dataForThisDate)
    ]);

    dataForThisDate.aiOverallAnalysis = aiOverall;
    dataForThisDate.questionUnitMap = unitMap;

    // 4. 치명적 오류 방지: 단원 맵 생성에 실패하면 이 반은 중단
    if (!unitMap || !unitMap.question_units) {
        throw new Error(`'${className}'의 문항-단원 맵(unitMap) 생성에 실패했습니다. AI 분석을 중단합니다.`);
    }

    console.log(`[${className}] Step 2/3: 학생 ${studentData.students.length}명 개별 분석 병렬 시작...`);

    // 5. [병렬 Step B] 모든 학생의 개별 분석을 병렬로 실행
    const studentPromises = studentData.students.map(student => {
        if (student.submitted) {
            // getAIAnalysis(student, data, selectedClass, questionUnitMap)
            return getAIAnalysis(student, dataForThisDate, className, unitMap);
        }
        return Promise.resolve(null); // 제출 안 한 학생
    });

    const studentAiResults = await Promise.all(studentPromises);

    // 6. AI 분석 결과를 원본 학생 데이터에 다시 삽입
    studentData.students.forEach((student, index) => {
        if (student.submitted) {
            student.aiAnalysis = studentAiResults[index];
        }
    });

    console.log(`[${className}] Step 3/3: 모든 분석 완료.`);
    
    // 7. '모든' AI 분석이 완료된 데이터 덩어리를 반환
    return dataForThisDate;
}


// --- 기존 useFileProcessor 훅 ---
export const useFileProcessor = ({ saveDataToFirestore }) => {
    const { 
        setProcessing, setErrorMessage, setTestData, 
        setCurrentPage, uploadDate, setSelectedDate
    } = useReportContext();
    
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);

    const handleFileChange = (e) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
            setErrorMessage('');
        }
    };
    
    const handleFileDrop = (files) => {
        if (files) {
            setSelectedFiles(Array.from(files));
            setErrorMessage('');
        }
    };

    // ⚠️ 3. handleFileProcess 로직이 '일괄 처리' 방식으로 완전히 변경됩니다.
    const handleFileProcess = useCallback(async () => {
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }

        setProcessing(true);
        setErrorMessage('파일 매칭 중...');
        
        const pairedFiles = pairFiles(selectedFiles); 
        const classNames = Object.keys(pairedFiles);
        
        if (classNames.length === 0) {
            setErrorMessage('파일 쌍(PDF 1개 + 성적표 1개)을 찾을 수 없습니다. 파일 이름을 확인해주세요 (예: "고1A반 시험지.pdf", "고1A반 성적표.csv")');
            setProcessing(false);
            return;
        }

        // ⚠️ 4. 최종적으로 DB에 저장될, 모든 반의 분석 완료 데이터
        let allAnalysedData = {};
        let hasError = false;

        // ⚠️ 5. API 차단을 막기 위해 '반' 단위로 '순차' 실행
        for (const className of classNames) {
            try {
                // (UX) 현재 진행 상황을 UI에 표시
                setErrorMessage(`'${className}' 분석 중... (1/3)`);
                console.log(`--- [${className}] AI 일괄 분석 시작 ---`);

                // ⚠️ 6. '한 개의 반'에 대한 '모든' 분석(공통+학생)을 '병렬'로 실행
                const singleClassFullData = await processClassBatch(
                    className, 
                    pairedFiles[className], 
                    uploadDate
                );
                
                // ⚠️ 7. 분석 완료된 데이터를 '날짜' 기준으로 최종 객체에 추가
                allAnalysedData[className] = {
                    [uploadDate]: singleClassFullData
                };

                console.log(`--- [${className}] AI 일괄 분석 완료 ---`);

            } catch (error) {
                console.error(`Error processing files for ${className}:`, error);
                setErrorMessage(`"${className}" 처리 오류: ${error.message}. 프로세스를 중단합니다.`);
                hasError = true;
                break; // 한 반이라도 실패하면 전체 중단
            }
        }

        if (hasError) {
            setProcessing(false);
            return;
        }

        try {
            // ⚠️ 8. 모든 반의 분석이 끝난 후, DB에 '단 한 번' 저장
            setErrorMessage('모든 분석 완료! DB에 저장 중...');
            await saveDataToFirestore(allAnalysedData); 
            
            // ⚠️ 9. 전역 상태도 '단 한 번' 업데이트
            setTestData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));
                Object.keys(allAnalysedData).forEach(className => {
                    if (!newData[className]) newData[className] = {};
                    // 중요: 날짜별로 데이터를 덮어쓰거나 추가합니다.
                    newData[className][uploadDate] = allAnalysedData[className][uploadDate];
                });
                return newData;
            });
            
            setErrorMessage(''); // 성공 시 오류 메시지 초기화
            setSelectedDate(uploadDate);
            setCurrentPage('page2'); // 반 선택 페이지로 이동

        } catch (error) {
            setErrorMessage('데이터 저장 중 오류 발생: ' + error.message);
        } finally {
            setProcessing(false);
            setSelectedFiles([]);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }, [selectedFiles, uploadDate, saveDataToFirestore, setProcessing, setErrorMessage, setTestData, setCurrentPage, setSelectedDate]);

    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};