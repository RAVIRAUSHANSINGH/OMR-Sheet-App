/**
 * @author Ravi Raushan
 * @project Mock OMR Sheet - Main Application Logic
 * @date November 2025
 * @Version  1.2
 * @description This script powers the Mock OMR Sheet application. It handles UI interactions,
 * state management, file parsing, grading logic, and PDF report generation.
 */

// 
// script.js
// This file contains all the logic for the OMR sheet.
//

// --- Setup: Tell PDF.js where to find its worker script ---
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js`;

// --- Setup: Extend Tailwind colors if we need to via JS (optional but handy) ---
tailwind.config = {
  theme: {
    extend: {
      colors: {
        glass: {
          100: 'rgba(255, 255, 255, 0.1)',
          500: 'rgba(255, 255, 255, 0.5)',
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'neon-blue': '0 0 10px rgba(59, 130, 246, 0.5)',
      }
    }
  }
}

// --- Grab all the DOM elements we need to interact with ---
// (It's like gathering your ingredients before cooking!)
const generateBtn = document.getElementById('generate-btn');
const questionCountInput = document.getElementById('question-count');
const correctMarksInput = document.getElementById('correct-marks');
const wrongMarksInput = document.getElementById('wrong-marks');
const configError = document.getElementById('config-error');

const omrContainer = document.getElementById('omr-container');
const omrSheet = document.getElementById('omr-sheet');
const timerDisplay = document.getElementById('timer-display');

const checkBtn = document.getElementById('check-btn');
const resetBtn = document.getElementById('reset-btn');
const savePdfBtn = document.getElementById('save-pdf-btn');
const fileUpload = document.getElementById('file-upload');
const manualKeyInput = document.getElementById('manual-key');
const checkError = document.getElementById('check-error');
const statusMessageEl = document.getElementById('status-message');

// Score display elements
const resultsDisplay = document.getElementById('results-display');
const scoreEl = document.getElementById('score');
const totalMarksInfoEl = document.getElementById('total-marks-info');
const timeTakenInfoEl = document.getElementById('time-taken-info');
const correctCountEl = document.getElementById('correct-count');
const incorrectCountEl = document.getElementById('incorrect-count');
const unansweredCountEl = document.getElementById('unanswered-count');
const marksBreakdownEl = document.getElementById('marks-breakdown');
const correctMarksTotalEl = document.getElementById('correct-marks-total');
const incorrectMarksTotalEl = document.getElementById('incorrect-marks-total');

// Modals
const formatModal = document.getElementById('format-modal');
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

// --- Variables to keep track of app state ---
let totalQuestions = 0;
let correctMarks = null;
let wrongMarks = null;
let answerKey = {};     // Will hold the correct answers like {1: 'A', 2: 'C'}
let timerInterval = null;
let startTime = 0;
let isGraded = false;   // Prevents editing after grading

// --- Listeners: Waiting for user actions ---
generateBtn.addEventListener('click', generateOMRSheet);
// Allow pressing 'Enter' to generate
questionCountInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') generateOMRSheet(); });
checkBtn.addEventListener('click', handleCheckAnswers);
resetBtn.addEventListener('click', resetEverything);
savePdfBtn.addEventListener('click', saveResultAsPDF);
fileUpload.addEventListener('change', handleFileUpload);
confirmYesBtn.addEventListener('click', handleConfirmProceed);
confirmNoBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));


// --- FUNCTION: Generate the OMR Sheet ---
function generateOMRSheet() {
    const count = parseInt(questionCountInput.value, 10);
    
    // Basic validation: don't let them crash the browser with 1 million questions
    if (isNaN(count) || count < 1 || count > 200) {
        showError(configError, 'Please enter a number between 1 and 200.');
        return;
    }
    hideError(configError);
    totalQuestions = count;
    
    // Get marking scheme if provided
    correctMarks = correctMarksInput.value ? parseFloat(correctMarksInput.value) : null;
    wrongMarks = wrongMarksInput.value ? parseFloat(wrongMarksInput.value) : null;
    
    // If they entered a positive number for negative marking, flip it (e.g., 1 becomes -1)
    if (wrongMarks !== null && wrongMarks > 0) wrongMarks = -wrongMarks;

    // Clear any old sheet
    omrSheet.innerHTML = '';
    
    // Loop to create rows
    for (let i = 1; i <= totalQuestions; i++) {
        omrSheet.appendChild(createQuestionRow(i));
    }

    // Show the sheet and start the clock!
    omrContainer.classList.remove('hidden');
    resetOMRState();
    startTimer();
    
    // Smooth scroll down to the sheet
    omrContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Helper: Create a single question row ---
function createQuestionRow(i) {
    const questionRow = document.createElement('div');
    // Add tailwind classes for styling
    questionRow.className = 'question-row group flex flex-wrap sm:flex-nowrap items-center justify-between p-4 rounded-2xl transition-all duration-300 hover:bg-white/20 border border-transparent';
    questionRow.id = `q-row-${i}`;
    
    // Create the 4 bubbles (A, B, C, D)
    const optionsHTML = ['A', 'B', 'C', 'D'].map(option => `
        <div class="flex items-center space-x-3">
            <input type="radio" name="question-${i}" id="q${i}-opt${option}" value="${option}" class="omr-radio">
            <label for="q${i}-opt${option}" class="font-bold cursor-pointer text-glass-medium select-none">${option}</label>
        </div>`).join('');
    
    // Create the "Clear" button (hidden by default/subtle)
    const clearBtn = `
        <button onclick="clearSelection(${i})" class="ml-2 sm:ml-4 text-xs font-bold text-glass-light hover:text-red-500 hover:bg-red-100/40 px-3 py-1.5 rounded-xl transition-all opacity-50 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" title="Clear answer for question ${i}">
            Clear
        </button>
    `;

    questionRow.innerHTML = `
        <div class="flex items-center w-full sm:w-auto mb-2 sm:mb-0">
            <span class="font-extrabold text-glass-dark w-8 sm:w-12 text-right mr-4 sm:mr-6 text-lg">${i}.</span>
        </div>
        <div class="flex items-center justify-between w-full sm:w-auto flex-1">
            <div class="flex items-center space-x-3 sm:space-x-8 justify-center flex-grow sm:flex-grow-0">${optionsHTML}</div>
            ${clearBtn}
        </div>`;
    return questionRow;
}

// --- Global Helper: Clear a selected radio button ---
window.clearSelection = function(i) {
    const radios = document.getElementsByName(`question-${i}`);
    radios.forEach(r => {
        r.checked = false;
        r.disabled = false; 
    });
}

// --- FUNCTION: Handle "Finish & Check" click ---
function handleCheckAnswers() {
    // Grab manual key if typed
    const manualKey = manualKeyInput.value.trim().toUpperCase();
    
    // Do we have a key?
    const hasAnswerKey = manualKey || Object.keys(answerKey).length > 0;

    if (hasAnswerKey) {
         if (manualKey) {
            // Validate manual key length
            if (manualKey.length !== totalQuestions) {
                showError(checkError, `Manual key has ${manualKey.length} answers, but there are ${totalQuestions} questions.`);
                return;
            }
            // convert string "ABCD..." to object {1:'A', 2:'B'...}
            answerKey = {};
            for (let i = 0; i < manualKey.length; i++) answerKey[i + 1] = manualKey[i];
        } else if (Object.keys(answerKey).length !== totalQuestions) {
            // Validate file key length
            showError(checkError, `Uploaded key has ${Object.keys(answerKey).length} answers, but there are ${totalQuestions} questions.`);
            return;
        }
        gradeSheet();
    } else {
        // No key? Ask user if they want to proceed anyway (just to make PDF)
        confirmModal.classList.remove('hidden');
    }
}

// --- FUNCTION: Grade the Sheet ---
function gradeSheet() {
    stopTimer();
    hideError(checkError);
    isGraded = true;
    
    let correct = 0, incorrect = 0, unanswered = 0;

    for (let i = 1; i <= totalQuestions; i++) {
        const row = document.getElementById(`q-row-${i}`);
        row.classList.remove('correct', 'incorrect');
        
        // Find what user clicked
        const selectedOption = document.querySelector(`input[name="question-${i}"]:checked`);
        const correctAnswer = answerKey[i];
        
        // Lock the question so they can't cheat now!
        document.querySelectorAll(`input[name="question-${i}"]`).forEach(radio => radio.disabled = true);
        
        // Hide clear button
        const clearBtn = row.querySelector('button');
        if (clearBtn) clearBtn.style.display = 'none';

        if (!selectedOption) {
            unanswered++;
        } else if (selectedOption.value === correctAnswer) {
            correct++;
            row.classList.add('correct'); // Green glow
        } else {
            incorrect++;
            row.classList.add('incorrect'); // Red glow
            // Highlight the correct answer so they learn
            const correctLabel = row.querySelector(`label[for="q${i}-opt${correctAnswer}"]`);
            if(correctLabel) correctLabel.classList.add('ring-4', 'ring-green-500/50', 'rounded-full', 'px-2', 'bg-green-100/50');
        }
    }
    
    // Calculate Marks if they provided a scheme
    if (correctMarks !== null) {
        const totalScore = (correct * correctMarks) + (incorrect * (wrongMarks || 0));
        const maxScore = totalQuestions * correctMarks;
        scoreEl.textContent = `${totalScore}`;
        totalMarksInfoEl.textContent = `out of ${maxScore}`;
        correctMarksTotalEl.textContent = `Gained: ${correct * correctMarks} marks`;
        incorrectMarksTotalEl.textContent = `| Lost: ${incorrect * (wrongMarks || 0)} marks`;
        marksBreakdownEl.classList.remove('hidden');
    } else {
        scoreEl.textContent = `${correct} / ${totalQuestions}`;
        totalMarksInfoEl.textContent = ``;
        marksBreakdownEl.classList.add('hidden');
    }

    // Update stats
    correctCountEl.textContent = `Correct: ${correct}`;
    incorrectCountEl.textContent = `Incorrect: ${incorrect}`;
    unansweredCountEl.textContent = `Unanswered: ${unanswered}`;
    
    // Show results
    resultsDisplay.classList.remove('hidden');
    resultsDisplay.classList.add('fade-in');
    savePdfBtn.classList.remove('hidden');
    resultsDisplay.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- FUNCTION: Proceed without checking (Just PDF) ---
function handleConfirmProceed() {
    confirmModal.classList.add('hidden');
    stopTimer();
    isGraded = false;
    
    // Lock everything up
    document.querySelectorAll('input[type="radio"]').forEach(radio => radio.disabled = true);
    document.querySelectorAll('.question-row button').forEach(btn => btn.style.display = 'none');

    showStatusMessage('You can now save your marked sheet.', 'success');
    
    // Change button to "Save PDF" since we can't check answers
    checkBtn.textContent = 'Save Marked Sheet as PDF';
    checkBtn.classList.remove('btn-liquid-green', 'shadow-neon-green');
    checkBtn.classList.add('btn-liquid-indigo', 'shadow-neon-blue');
    checkBtn.onclick = () => saveResultAsPDF();
}

// --- FUNCTION: Generate and Download PDF ---
async function saveResultAsPDF() {
    showStatusMessage('Generating PDF...', 'success');
    
    // Wait a split second so the UI updates first
    setTimeout(() => {
         const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const margin = 15;
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        let yPos = 20;

        // Title
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text("OMR Test Report", pdfWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        // Add Score info to PDF if we graded it
        if (isGraded) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            
            const scoreText = scoreEl.textContent.trim();
            const totalMarksText = totalMarksInfoEl.textContent.trim();
            pdf.text(`Your Score: ${scoreText} ${totalMarksText}`, margin, yPos);
            yPos += 7;
            
            const timeText = timeTakenInfoEl.textContent.trim();
            pdf.text(timeText, margin, yPos);
            yPos += 10;
            
            const correctText = correctCountEl.textContent.trim();
            const incorrectText = incorrectCountEl.textContent.trim();
            const unansweredText = unansweredCountEl.textContent.trim();
            pdf.text(`${correctText} | ${incorrectText} | ${unansweredText}`, margin, yPos);
            yPos += 7;
        } else {
             // Just time taken if not graded
             const timeText = timeTakenInfoEl.textContent.trim();
             pdf.setFont("helvetica", "normal");
             pdf.setFontSize(11);
             pdf.text(timeText, margin, yPos);
             yPos += 10;
        }

        // Line separator
        pdf.setLineWidth(0.2);
        pdf.line(margin, yPos, pdfWidth - margin, yPos);
        yPos += 10;

        // Draw bubbles on PDF (Manual drawing for best quality)
        const questionSpacing = 10;
        const optionSpacing = 20;
        const circleRadius = 3;

        for (let i = 1; i <= totalQuestions; i++) {
            // New page if we run out of space
            if (yPos > pageHeight - margin) {
                pdf.addPage();
                yPos = margin;
            }

            const selectedOption = document.querySelector(`input[name="question-${i}"]:checked`);
            const userAnswer = selectedOption ? selectedOption.value : null;
            const correctAnswer = answerKey[i];
            
            // Question Number
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.text(`${i}.`, margin, yPos + circleRadius);

            let xPos = margin + 15;
            const options = ['A', 'B', 'C', 'D'];

            options.forEach(option => {
                pdf.setFont("helvetica", "normal");
                pdf.text(option, xPos, yPos + circleRadius);
                
                const circleX = xPos + 5;
                const circleY = yPos + circleRadius - 1;

                // Default: Black outline, white fill
                pdf.setDrawColor(0); 
                pdf.setFillColor(255, 255, 255); 

                let drawStyle = 'D'; // Default to Draw Outline

                // If user picked this
                if (userAnswer === option) {
                    pdf.setFillColor(37, 99, 235); // Blue fill
                    pdf.setDrawColor(29, 78, 216); // Blue border
                    if (isGraded) {
                        if (userAnswer === correctAnswer) {
                            pdf.setFillColor(22, 163, 74); // Green (Correct)
                            pdf.setDrawColor(21, 128, 61); 
                        } else {
                            pdf.setFillColor(220, 38, 38); // Red (Wrong)
                            pdf.setDrawColor(185, 28, 28);
                        }
                    }
                    drawStyle = 'FD'; // Fill and Draw
                }
                
                pdf.circle(circleX, circleY, circleRadius, drawStyle);

                // If they got it wrong, circle the correct answer in Green
                if (isGraded && userAnswer !== correctAnswer && option === correctAnswer) {
                    pdf.setDrawColor(22, 163, 74);
                    pdf.setLineWidth(0.5);
                    pdf.circle(circleX, circleY, circleRadius + 0.5, 'D');
                    pdf.setLineWidth(0.2); 
                }

                xPos += optionSpacing;
            });
            yPos += questionSpacing;
        }

        pdf.save('omr_report.pdf');
        hideStatusMessage();
    }, 100);
}

// --- Timer Logic ---
function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        timerDisplay.textContent = formatTime(elapsedTime);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    const elapsedTime = Date.now() - startTime;
    timeTakenInfoEl.textContent = `Time Taken: ${formatTime(elapsedTime)}`;
}

// Pretty print time (mm:ss)
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

// --- Reset Logic ---
function resetEverything() {
    questionCountInput.value = '';
    correctMarksInput.value = '';
    wrongMarksInput.value = '';
    omrContainer.classList.add('hidden');
    omrSheet.innerHTML = '';
    totalQuestions = 0;
    correctMarks = null;
    wrongMarks = null;
    resetOMRState();
    clearInterval(timerInterval);
    timerDisplay.textContent = '00:00';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetOMRState() {
    answerKey = {};
    fileUpload.value = '';
    manualKeyInput.value = '';
    resultsDisplay.classList.add('hidden');
    marksBreakdownEl.classList.add('hidden');
    savePdfBtn.classList.add('hidden');
    hideError(checkError);
    hideStatusMessage();
    isGraded = false;
    
    checkBtn.textContent = 'Finish & Check';
    checkBtn.className = 'w-full btn-liquid-green text-white font-bold py-4 px-6 rounded-2xl transition-all transform active:scale-95 shadow-neon-green';
    checkBtn.onclick = handleCheckAnswers;
    
    // Re-enable everything
    document.querySelectorAll('.question-row').forEach(row => {
        row.classList.remove('correct', 'incorrect');
        row.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.disabled = false;
            radio.checked = false;
        });
        // Remove hint rings
        const hintLabel = row.querySelector('.ring-4');
        if(hintLabel) hintLabel.classList.remove('ring-4', 'ring-green-500/50', 'rounded-full', 'px-2', 'bg-green-100/50');
        
        // Show clear buttons again
        const clearBtn = row.querySelector('button');
        if (clearBtn) clearBtn.style.display = '';
    });
}

// --- File Processing Logic ---
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Update UI to show filename
    event.target.parentElement.querySelector('label').textContent = `Selected: ${file.name}`;

    const reader = new FileReader();
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'xlsx' || extension === 'xls') {
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                parseAnswerKeyFromExcel(json);
            } catch (err) {
                showError(checkError, 'Failed to process Excel file.');
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (extension === 'pdf') {
        reader.onload = (e) => {
            const typedarray = new Uint8Array(e.target.result);
            pdfjsLib.getDocument(typedarray).promise.then(pdf => {
                let pagesPromises = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    pagesPromises.push(pdf.getPage(i).then(page => page.getTextContent()));
                }
                return Promise.all(pagesPromises);
            }).then(textContents => {
                let fullText = '';
                textContents.forEach(content => {
                    content.items.forEach(item => { fullText += item.str + ' '; });
                    fullText += '\n';
                });
                parseAnswerKeyFromText(fullText);
            }).catch(() => showError(checkError, 'Failed to process PDF file.'));
        };
        reader.readAsArrayBuffer(file);
    } else {
        showError(checkError, 'Unsupported file type. Please use .xlsx, .xls, or .pdf');
    }
}

// Excel Parsing
function parseAnswerKeyFromExcel(data) {
    const newKey = {};
    let parsedCount = 0;
    data.forEach(row => {
        const qNum = parseInt(row[0], 10);
        const answer = String(row[1]).trim().toUpperCase();
        if (!isNaN(qNum) && ['A', 'B', 'C', 'D'].includes(answer)) {
            newKey[qNum] = answer;
            parsedCount++;
        }
    });
    if(parsedCount > 0) {
        answerKey = newKey;
        manualKeyInput.value = '';
        hideError(checkError);
        showStatusMessage(`${parsedCount} answers loaded successfully.`, 'success');
    } else {
        showError(checkError, 'Could not find valid answers in the Excel file.');
    }
}

// PDF Parsing (Text extraction)
function parseAnswerKeyFromText(text) {
    // Look for patterns like "1. A" or "2: C"
    const regex = /(\d+)\s*[:.-]?\s*([A-D])\b/g;
    let match;
    const newKey = {};
    let parsedCount = 0;
    while ((match = regex.exec(text)) !== null) {
        newKey[parseInt(match[1], 10)] = match[2].toUpperCase();
        parsedCount++;
    }
    
    if(parsedCount > 0) {
        answerKey = newKey;
        manualKeyInput.value = '';
        hideError(checkError);
        showStatusMessage(`${parsedCount} answers loaded successfully.`, 'success');
    } else {
        showError(checkError, 'Could not find valid answers in the PDF.');
    }
}

// --- UI Utils ---
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideError(element) {
    element.classList.add('hidden');
}
function showStatusMessage(message, type = 'success') {
    statusMessageEl.textContent = message;
    statusMessageEl.className = `p-4 mb-6 rounded-2xl text-center font-bold backdrop-blur-md shadow-sm border ${type === 'success' ? 'bg-green-100/50 text-green-800 border-green-200/50' : 'bg-red-100/50 text-red-800 border-red-200/50'}`;
    statusMessageEl.classList.remove('hidden');
    statusMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideStatusMessage() {
    statusMessageEl.classList.add('hidden');
    document.querySelector('label[for="file-upload"]').textContent = 'Upload Answer Key';
}
function showFormatInfo() { formatModal.classList.remove('hidden'); }
function hideFormatInfo() { formatModal.classList.add('hidden'); }