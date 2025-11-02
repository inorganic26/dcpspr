import { useRef, useState, useCallback } from 'react';
import { useReportContext } from '../context/ReportContext';
import { parsePDF, parseCSV, parseXLSX, processStudentData } from '../lib/fileParser'; 
import { getOverallAIAnalysis, getQuestionUnitMapping } from '../lib/ai.js'; 

// --- 새로운 파일명 기반 페어링 로직을 위한 헬퍼 함수 ---
/**
 * 파일명에서 확장자를 제외한 기본 이름을 추출합니다.
 * 예: "고1A반 시험지.pdf" -> "고1A반 시험지"
 */
const getBaseName = (fileName) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName;
    
    // 확장자 목록 (PDF, CSV, XLSX)
    const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
    if (['pdf', 'csv', 'xlsx'].includes(extension)) {
        // 확장자를 제외한 부분만 반환
        return fileName.substring(0, lastDotIndex);
    }
    // 확장자가 없거나 다른 경우 전체 파일명 반환
    return fileName;
};
// ----------------------------------------------------

export const useFileProcessor = ({ saveDataToFirestore }) => {
    const { 
        setProcessing, setErrorMessage, setTestData, 
        setCurrentPage, uploadDate, setUploadDate, setSelectedDate
    } = useReportContext();
    
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);

    // ⭐️ [변경] 파일 선택 및 드롭 로직 통합 헬퍼 함수
    const updateSelectedFiles = (files) => {
        setSelectedFiles(Array.from(files));
        setErrorMessage('');
    };

    const handleFileChange = (e) => {
        if (e.target.files) {
            updateSelectedFiles(e.target.files);
        }
    };
    
    // ⭐️ [추가] 드래그 앤 드롭으로 파일이 들어왔을 때 처리하는 함수
    const handleFileDrop = (files) => {
        if (files) {
            updateSelectedFiles(files);
        }
    };
    // ⭐️ [변경] 통합된 파일 선택 로직 종료

    const handleFileProcess = useCallback(async () => {
        if (!uploadDate) {
            setErrorMessage('시험 날짜를 선택해야 합니다.');
            return;
        }

        setProcessing(true);
        setErrorMessage('');

        // ⭐️ [변경] 파일명 기반 페어링 로직 구현 시작
        const pairedFiles = {}; // { baseName: { pdf: File, spreadsheet: File } }
        let filePairingError = false;

        selectedFiles.forEach(file => {
            const baseName = getBaseName(file.name);
            if (!pairedFiles[baseName]) {
                pairedFiles[baseName] = {};
            }

            const extension = file.name.split('.').pop().toLowerCase();

            if (extension === 'pdf') {
                if (pairedFiles[baseName].pdf) {
                     filePairingError = true;
                     setErrorMessage(`'${baseName}' 파일명으로 PDF 파일이 2개 이상 선택되었습니다.`);
                     return;
                }
                pairedFiles[baseName].pdf = file;
            } else if (['csv', 'xlsx'].includes(extension)) {
                 if (pairedFiles[baseName].spreadsheet) {
                     filePairingError = true;
                     setErrorMessage(`'${baseName}' 파일명으로 성적표 파일이 2개 이상 선택되었습니다.`);
                     return;
                }
                pairedFiles[baseName].spreadsheet = file;
            }
            // 그 외 파일 형식은 무시
        });
        
        if (filePairingError) {
             setProcessing(false);
             return;
        }
        
        // 유효한 페어만 필터링하고 불완전한 페어 체크
        const validPairedFiles = {};
        const classNames = Object.keys(pairedFiles);
        
        for (const key of classNames) {
            const pair = pairedFiles[key];
            if (pair.pdf && pair.spreadsheet) {
                validPairedFiles[key] = pair;
            } else if (pair.pdf || pair.spreadsheet) {
                // 불완전한 페어는 에러 처리
                setErrorMessage(`'${key}' 파일 쌍이 불완전합니다. (필요: PDF 1개 + 성적표 1개)`);
                filePairingError = true;
                break;
            }
        }
        
        if (filePairingError) {
            setProcessing(false);
            return;
        }

        const finalClassNames = Object.keys(validPairedFiles);

        if (finalClassNames.length === 0) {
            setErrorMessage('파일 쌍(PDF 1개 + 성적표 1개)을 찾을 수 없습니다. 파일 이름을 확인해주세요 (예: "고1A반.pdf", "고1A반.xlsx")');
            setProcessing(false);
            return;
        }
        // ⭐️ [변경] 파일명 기반 페어링 로직 구현 종료

        let hasError = false;
        let mergedData = {};

        for (const key of finalClassNames) { // validPairedFiles의 키를 사용
            const { pdf, spreadsheet } = validPairedFiles[key]; // validPairedFiles 사용
            try {
                // 1. 파일 파싱 (기존과 동일)
                const pdfText = await parsePDF(pdf);
                const spreadsheetData = spreadsheet.name.endsWith('.csv') ? 
                    await parseCSV(spreadsheet) : 
                    await parseXLSX(spreadsheet);
                
                const studentData = processStudentData(spreadsheetData);
                
                // 2. 데이터 기본 구조 생성 (기존과 동일)
                mergedData[key] = {
                    [uploadDate]: {
                        pdfInfo: { fileName: pdf.name, fullText: pdfText },
                        studentData: studentData,
                        aiOverallAnalysis: null, // (곧 채워짐)
                        questionUnitMap: null, // (곧 채워짐)
                    }
                };
                const overallData = mergedData[key][uploadDate];

                // ⭐️ 3. [변경] AI 분석 2개를 파일 처리 시점에 미리 호출
                setProcessing(true, `"${key}" 반 AI 분석 중...`);
                
                const overallPromise = getOverallAIAnalysis(overallData);
                const unitMapPromise = getQuestionUnitMapping(overallData);

                // ⭐️ 4. [변경] AI 분석 결과를 기다림
                const [aiOverall, unitMap] = await Promise.all([overallPromise, unitMapPromise]);
                
                // ⭐️ 5. [변경] AI 결과를 데이터에 저장
                overallData.aiOverallAnalysis = aiOverall;
                overallData.questionUnitMap = unitMap;

            } catch (error) {
                console.error(`Error processing files for ${key}:`, error);
                setErrorMessage(`"${key}" 처리 오류: ${error.message}`);
                hasError = true;
                break;
            }
        }

        if (hasError) {
            setProcessing(false);
            return;
        }

        try {
            // ⭐️ 6. [변경] AI 분석이 포함된 데이터를 DB에 저장
            await saveDataToFirestore(mergedData); 
            
            // ⭐️ 7. [변경] 전역 상태도 AI 분석이 포함된 데이터로 업데이트
            setTestData(prevData => {
                const newData = JSON.parse(JSON.stringify(prevData));
                Object.keys(mergedData).forEach(className => {
                    if (!newData[className]) newData[className] = {};
                    newData[className][uploadDate] = mergedData[className][uploadDate];
                });
                return newData;
            });
            
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

    // ⭐️ [변경] handleFileDrop 함수를 반환 목록에 추가
    return { fileInputRef, selectedFiles, handleFileChange, handleFileProcess, handleFileDrop };
};