// js/reports.js
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 [Reports] DOMContentLoaded fired');

  // Check auth
  console.log('🔐 [Reports] Checking auth...');
  const user = await window.checkAuth();

  if (!user) {
    console.error('❌ [Reports] No user found, redirecting...');
    return;
  }

  console.log('✅ [Reports] Auth successful');
  window.renderHeader(user);

  let quizzes = [];
  let results = [];
  let filterDate = '';
  let filterTime = '';
  let filterQuizCode = '';
  let quizFibShortCountMap = {}; // quizId -> number of FIB/Short Answer questions

  const reportsContainer = document.getElementById('reports-container');
  const studentHistoryModal = document.getElementById('studentHistoryModal');
  const studentHistoryName = document.getElementById('studentHistoryName');
  const studentHistoryTotalQuizzes = document.getElementById('studentHistoryTotalQuizzes');
  const studentHistoryAverage = document.getElementById('studentHistoryAverage');
  const studentHistoryTableBody = document.getElementById('studentHistoryTableBody');
  const closeStudentHistory = document.getElementById('closeStudentHistory');

  // Question Review Modal Elements
  const questionReviewModal = document.getElementById('questionReviewModal');
  const questionReviewTitle = document.getElementById('questionReviewTitle');
  const questionReviewContent = document.getElementById('questionReviewContent');
  const closeQuestionReview = document.getElementById('closeQuestionReview');

  // Manual CSV Grading Elements
  const manualCsvInput = document.getElementById('manualCsvInput');
  const btnViewCsvPlain = document.getElementById('btnViewCsvPlain');
  const btnSubmitCsvGrade = document.getElementById('btnSubmitCsvGrade');
  const csvPlainPreview = document.getElementById('csvPlainPreview');

  let currentCsvData = null; // Store parsed CSV data for submission

  // AI Grading Elements
  const aiGradesPasteInput = document.getElementById('aiGradesPasteInput');
  const btnViewAiGrades = document.getElementById('btnViewAiGrades');
  const btnImportAiGrades = document.getElementById('btnImportAiGrades');
  const aiGradesReviewContainer = document.getElementById('aiGradesReviewContainer');
  const aiGradesReviewTable = document.getElementById('aiGradesReviewTable');

  // Metric elements
  const metricTotalAttended = document.getElementById('metric-total-attended');
  const metricQuizScope = document.getElementById('metric-quiz-scope');
  const metricAverageScore = document.getElementById('metric-average-score');
  const metricAverageScope = document.getElementById('metric-average-scope');
  const metricLatestTime = document.getElementById('metric-latest-time');
  const metricLatestStudent = document.getElementById('metric-latest-student');

  // Load quizzes and results
  async function loadReportData() {
    console.log('📊 [Reports] Initializing report data load...');
    console.log('👤 [Reports] Current user:', user);
    console.log('👤 [Reports] User ID:', user.id);

    try {
      reportsContainer.innerHTML = `
        <div class="py-24 flex justify-center items-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      `;

      // 1. Fetch teacher quizzes
      console.log('🔍 [Reports] Fetching teacher quizzes...');
      const { data: quizzesData, error: quizzesError } = await window.supabaseClient
        .from('quizzes')
        .select('id, title, access_code')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (quizzesError) {
        console.error('❌ [Reports] Error fetching quizzes:', quizzesError);
        throw quizzesError;
      }

      quizzes = quizzesData || [];
      console.log('✅ [Reports] Quizzes fetched successfully:', quizzes.length, 'quizzes');

      // 1a. Fetch quiz_questions with question_bank to count FIB/Short Answer per quiz
      if (quizzes.length > 0) {
        const quizIds = quizzes.map(q => q.id);
        const { data: quizQuestions, error: qqError } = await window.supabaseClient
          .from('quiz_questions')
          .select('quiz_id, question_bank(*)')
          .in('quiz_id', quizIds);

        if (qqError) {
          console.warn('⚠️ [Reports] Error fetching quiz questions:', qqError);
        } else {
          console.log('📥 [Reports] All quizQuestions:', quizQuestions);
          // Initialize map with 0 for all quizzes
          quizFibShortCountMap = {};
          quizIds.forEach(id => quizFibShortCountMap[id] = 0);

          // Count FIB/Short Answer
          if (quizQuestions) {
            quizQuestions.forEach(qq => {
              console.log('👉 [Reports] Processing quiz question:', qq);
              if (qq.question_bank) {
                const qType = qq.question_bank.type || 'MCQ';
                console.log('   [Reports] qType:', qType);
                if (qType === 'FIB' || qType === 'Short Answer' || qType === 'SHORT_ANSWER' || qType === 'Fill in the Blanks') {
                  quizFibShortCountMap[qq.quiz_id] = (quizFibShortCountMap[qq.quiz_id] || 0) + 1;
                  console.log('   [Reports] Incremented count for quiz', qq.quiz_id, 'to', quizFibShortCountMap[qq.quiz_id]);
                }
              }
            });
          }
          console.log('✅ [Reports] Quiz FIB/Short Answer counts:', quizFibShortCountMap);
        }
      }

      if (quizzes.length === 0) {
        // No quizzes = no results possible
        console.log('ℹ️ [Reports] No quizzes found for this teacher');
        results = [];
        renderEmptyState();
        updateMetrics([]);
        return;
      }

      // 2. Fetch student results
      const teacherQuizIds = quizzes.map((q) => q.id);
      console.log('🔍 [Reports] Teacher quiz IDs:', teacherQuizIds);

      // Safety check for empty quiz IDs array
      if (teacherQuizIds.length === 0) {
        console.log('ℹ️ [Reports] No quiz IDs to filter results');
        results = [];
        renderEmptyState();
        updateMetrics([]);
        return;
      }

      console.log('🔍 [Reports] Fetching student results...');
      const { data: resultsData, error: resultsError } = await window.supabaseClient
        .from('student_results')
        .select('*, quizzes(title, access_code)')
        .in('quiz_id', teacherQuizIds)
        .order('completed_at', { ascending: false });

      if (resultsError) {
        console.error('❌ [Reports] Error fetching results:', resultsError);
        throw resultsError;
      }

      results = resultsData || [];
      console.log('✅ [Reports] Results fetched successfully:', results.length, 'results');
      filterAndRender();
    } catch (err) {
      console.error('❌ [Reports] Unhandled error in loadReportData:', err);
      reportsContainer.innerHTML = `
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-md mx-auto">
          <i data-lucide="alert-circle" class="w-10 h-10 text-rose-400 mx-auto mb-3"></i>
          <h3 class="text-base font-bold text-rose-800">Failed to load reports</h3>
          <p class="text-rose-600 text-sm mt-1">${escapeHtml(err.message)}</p>
        </div>
      `;
      window.lucide.createIcons();
    }
  }

  // Filter and Render based on date, time, and quiz code
  function filterAndRender() {
    let filtered = results;

    // Apply quiz code filter if set
    if (filterQuizCode) {
      filtered = filtered.filter(r => {
        const code = r.quizzes?.access_code || '';
        return code.toLowerCase().toUpperCase() === filterQuizCode.toUpperCase();
      });
    }

    // Apply date filter only if it's a valid full date
    if (filterDate) {
      const dateParts = filterDate.split('-');
      // Check if we have a valid 4-digit year, 2-digit month, and 2-digit day
      if (dateParts.length === 3 &&
          dateParts[0].length === 4 &&
          !isNaN(parseInt(dateParts[0])) &&
          dateParts[1].length === 2 &&
          !isNaN(parseInt(dateParts[1])) &&
          dateParts[2].length === 2 &&
          !isNaN(parseInt(dateParts[2]))) {

        filtered = filtered.filter(r => {
          const completedAt = new Date(r.completed_at);
          const rDate = completedAt.toISOString().split('T')[0]; // YYYY-MM-DD
          return rDate === filterDate;
        });
      }
    }

    // Apply time filter only if it's a valid full time (HH:MM)
    if (filterTime) {
      const timeParts = filterTime.split(':');
      if (timeParts.length === 2 &&
          timeParts[0].length === 2 &&
          !isNaN(parseInt(timeParts[0])) &&
          timeParts[1].length === 2 &&
          !isNaN(parseInt(timeParts[1]))) {

        filtered = filtered.filter(r => {
          const completedAt = new Date(r.completed_at);
          const hours = String(completedAt.getHours()).padStart(2, '0');
          const minutes = String(completedAt.getMinutes()).padStart(2, '0');
          const rTime = `${hours}:${minutes}`;
          return rTime === filterTime;
        });
      }
    }

    updateMetrics(filtered);
    renderTable(filtered);
  }

  // Update metrics row
  function updateMetrics(list) {
    // Total Attended
    metricTotalAttended.textContent = list.length;
    metricQuizScope.textContent = 'All Quizzes';

    // Average Score
    if (list.length === 0) {
      metricAverageScore.textContent = '—';
      metricAverageScope.textContent = 'No data yet';
    } else {
      const sumPct = list.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0);
      const avgPct = Math.round(sumPct / list.length);
      metricAverageScore.textContent = `${avgPct}%`;
      metricAverageScope.textContent = 'Across all submissions';
    }

    // Latest Submission
    if (list.length === 0) {
      metricLatestTime.textContent = '—';
      metricLatestStudent.textContent = 'No data yet';
    } else {
      const latest = list[0];
      metricLatestTime.textContent = formatDate(latest.completed_at);
      metricLatestStudent.textContent = latest.student_name;
    }
  }

  // Render submissions table
  function renderTable(list) {
    const scopeName = 'All Quizzes';

    if (list.length === 0) {
      renderEmptyState();
      return;
    }

    let tableHtml = `
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-slide-up">
        <!-- Table title bar -->
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <h2 class="text-sm font-bold text-slate-800">
              Student Results — <span class="text-blue-600">${escapeHtml(scopeName)}</span>
            </h2>
            <button id="btnCopyAllCsv" class="inline-flex items-center justify-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer">
              📋 Copy All CSV
            </button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-400 mr-2">
              ${list.length} record${list.length !== 1 ? 's' : ''}
            </span>
            <input type="text" id="filterQuizCode" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" style="width: auto;" placeholder="Enter Quiz Code" value="${filterQuizCode}">
            <input type="date" id="filterDateInput" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" style="width: auto;" value="${filterDate}">
            <input type="time" id="filterTimeInput" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" style="width: auto;" value="${filterTime}">
            <button id="btnApplyDateTimeFilter" class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition cursor-pointer">Filter</button>
            <button id="btnClearDateTimeFilter" class="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">Clear</button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100">
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">S.NO</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quiz</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Total Questions</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Percentage</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Grade</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Completed At</th>
                <th class="px-6 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">AI Grading Data</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
    `;

    list.forEach((result, idx) => {
      const pct = Math.round((result.score / result.total_questions) * 100);
      const { grade, colorClass } = getLetterGrade(pct);
      const title = result.quizzes?.title || 'Unknown Quiz';
      const code = result.quizzes?.access_code || '';

      tableHtml += `
        <tr class="hover:bg-slate-50/60 transition-colors duration-100">
          <td class="px-6 py-4 text-slate-400 font-medium text-xs">${idx + 1}</td>
          <td class="px-6 py-4">
            <button
              onclick="window.openStudentHistory('${escapeHtml(result.student_name)}')"
              class="font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer transition-colors"
            >
              ${escapeHtml(result.student_name)}
            </button>
          </td>
          <td class="px-6 py-4">
            <span class="block font-medium text-slate-700 max-w-[180px] truncate">
              ${escapeHtml(title)}
            </span>
            <span class="text-[11px] font-mono text-slate-400">
              ${code}
            </span>
          </td>
          <td class="px-6 py-4">
            <span class="text-slate-600 font-medium block">${result.total_questions}</span>
            <button
              class="btn-view-responses inline-flex items-center justify-center px-2 py-1 bg-slate-50 hover:bg-slate-100 text-blue-600 text-xs font-semibold rounded transition cursor-pointer"
              data-submission-id="${result.id}"
            >
              View
            </button>
          </td>
          <td class="px-6 py-4">
            <span class="font-bold text-slate-900">${result.score}</span>
            <span class="text-slate-400 font-medium"> / ${result.total_questions}</span>
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-2.5">
              <div class="w-20 bg-slate-100 rounded-full h-1.5 shrink-0">
                <div
                  class="h-full rounded-full ${getProgressColorClass(pct)}"
                  style="width: ${pct}%"
                ></div>
              </div>
              <span class="text-xs font-bold text-slate-700 w-9 shrink-0">${pct}%</span>
            </div>
          </td>
          <td class="px-6 py-4">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-black ${colorClass}">
              ${grade}
            </span>
          </td>
          <td class="px-6 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
            ${formatDate(result.completed_at)}
          </td>
          <td class="px-6 py-4">
            ${(() => {
              const fibShortCount = quizFibShortCountMap[result.quiz_id] || 0;
              if (fibShortCount === 0) {
                return `<span class="text-xs text-slate-400">Null</span>`;
              } else {
                return `<button
                  class="copy-csv-btn inline-flex items-center justify-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                  data-submission-id="${result.id}"
                  data-student-name="${escapeHtml(result.student_name)}"
                  data-quiz-title="${escapeHtml(title)}"
                >
                  📋 Copy Row CSV
                </button>`;
              }
            })()}
          </td>
        </tr>
      `;
    });

    tableHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    reportsContainer.innerHTML = tableHtml;
  }

  // Render empty state
  function renderEmptyState() {
    reportsContainer.innerHTML = `
      <div class="bg-white border border-slate-200 rounded-2xl p-14 text-center shadow-sm max-w-lg mx-auto animate-slide-up">
        <div class="inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl mb-4">
          <i data-lucide="bar-chart-3" class="w-8 h-8 text-slate-300"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">
          No students have completed this quiz yet
        </h3>
        <p class="text-slate-500 text-sm mt-2 max-w-xs mx-auto">
          Once students submit their answers using the access code, their results will appear here.
        </p>
      </div>
    `;
    window.lucide.createIcons();
  }

  // Grade helper
  function getLetterGrade(pct) {
    if (pct >= 80) return { grade: 'A', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (pct >= 60) return { grade: 'B', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (pct >= 40) return { grade: 'C', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { grade: 'F', colorClass: 'text-rose-700 bg-rose-50 border-rose-200' };
  }

  function getProgressColorClass(pct) {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-blue-500';
    if (pct >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  }

  // Date formatter
  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Open Student History Modal
  window.openStudentHistory = function(studentName) {
    console.log('📊 [Reports] Opening history for student:', studentName);

    // Filter results for this student
    const studentResults = results.filter(r => r.student_name === studentName);
    console.log('📊 [Reports] Student results:', studentResults.length, 'attempts');

    // Update modal title
    studentHistoryName.textContent = `Student History: ${studentName}`;

    // Update summary stats
    studentHistoryTotalQuizzes.textContent = studentResults.length;

    if (studentResults.length > 0) {
      const sumPct = studentResults.reduce((sum, r) => sum + (r.score / r.total_questions) * 100, 0);
      const avgPct = Math.round(sumPct / studentResults.length);
      studentHistoryAverage.textContent = `${avgPct}%`;
    } else {
      studentHistoryAverage.textContent = '—';
    }

    // Render table body
    let tableBodyHtml = '';
    studentResults.forEach((result, idx) => {
      const pct = Math.round((result.score / result.total_questions) * 100);
      const { grade, colorClass } = getLetterGrade(pct);
      const title = result.quizzes?.title || 'Unknown Quiz';
      const code = result.quizzes?.access_code || '';

      tableBodyHtml += `
        <tr class="hover:bg-slate-50/60 transition-colors duration-100">
          <td class="px-4 py-3 text-slate-400 font-medium text-xs">${idx + 1}</td>
          <td class="px-4 py-3">
            <span class="font-semibold text-slate-900">${escapeHtml(result.student_name)}</span>
          </td>
          <td class="px-4 py-3">
            <span class="block font-medium text-slate-700 max-w-[180px] truncate">
              ${escapeHtml(title)}
            </span>
            <span class="text-[11px] font-mono text-slate-400">
              ${code}
            </span>
          </td>
          <td class="px-4 py-3">
            <span class="text-slate-600 font-medium block">${result.total_questions}</span>
            <button
              class="btn-view-responses inline-flex items-center justify-center px-2 py-1 bg-slate-50 hover:bg-slate-100 text-blue-600 text-xs font-semibold rounded transition cursor-pointer"
              data-submission-id="${result.id}"
            >
              View
            </button>
          </td>
          <td class="px-4 py-3">
            <span class="font-bold text-slate-900">${result.score}</span>
            <span class="text-slate-400 font-medium"> / ${result.total_questions}</span>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2.5">
              <div class="w-20 bg-slate-100 rounded-full h-1.5 shrink-0">
                <div
                  class="h-full rounded-full ${getProgressColorClass(pct)}"
                  style="width: ${pct}%"
                ></div>
              </div>
              <span class="text-xs font-bold text-slate-700 w-9 shrink-0">${pct}%</span>
            </div>
          </td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-black ${colorClass}">
              ${grade}
            </span>
          </td>
          <td class="px-4 py-3 text-slate-500 text-xs font-medium whitespace-nowrap">
            ${formatDate(result.completed_at)}
          </td>
        </tr>
      `;
    });

    studentHistoryTableBody.innerHTML = tableBodyHtml;

    // Show modal
    studentHistoryModal.classList.remove('hidden');
  }

  // Close Student History Modal
  function closeStudentHistoryModal() {
    studentHistoryModal.classList.add('hidden');
  }

  // Close Question Review Modal
  function closeQuestionReviewModal() {
    questionReviewModal.classList.add('hidden');
  }

  // Add event listeners for closing modals
  closeStudentHistory.addEventListener('click', closeStudentHistoryModal);
  studentHistoryModal.addEventListener('click', (e) => {
    if (e.target === studentHistoryModal) {
      closeStudentHistoryModal();
    }
  });

  closeQuestionReview.addEventListener('click', closeQuestionReviewModal);
  questionReviewModal.addEventListener('click', (e) => {
    if (e.target === questionReviewModal) {
      closeQuestionReviewModal();
    }
  });

  // --- Question review helpers (schema: student_results.id ↔ student_responses.student_result_id) ---

  function normalizeQuestionType(type) {
    const key = (type || 'MCQ').trim().toUpperCase();
    if (key === 'FILL IN THE BLANKS') return 'FIB';
    if (key === 'SHORT ANSWER') return 'SHORT_ANSWER';
    return key;
  }

  function normalizeMcqLetter(answer, question) {
    const trimmed = (answer || '').trim();
    if (!trimmed) return '';
    const upper = trimmed.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(upper)) return upper;
    for (const letter of ['A', 'B', 'C', 'D']) {
      const optText = (question[`option_${letter.toLowerCase()}`] || '').trim();
      if (optText && optText.toLowerCase() === trimmed.toLowerCase()) return letter;
    }
    return upper;
  }

  function getMcqCorrectLetter(question) {
    const raw = (question.correct_option || '').trim();
    if (!raw) return '';
    const upper = raw.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(upper)) return upper;
    for (const letter of ['A', 'B', 'C', 'D']) {
      const optText = (question[`option_${letter.toLowerCase()}`] || '').trim();
      if (optText && optText.toLowerCase() === raw.toLowerCase()) return letter;
    }
    return upper;
  }

  function buildResponseLookupMaps(responses) {
    const byQuestionBankId = new Map();
    const byQuestionText = new Map();
    (responses || []).forEach((resp) => {
      if (resp.question_bank_id != null) {
        byQuestionBankId.set(String(resp.question_bank_id), resp);
      }
      if (resp.question_text) {
        const textKey = resp.question_text.trim().toLowerCase();
        if (!byQuestionText.has(textKey)) {
          byQuestionText.set(textKey, resp);
        }
      }
    });
    return { byQuestionBankId, byQuestionText };
  }

  function findStudentResponse(question, maps) {
    if (!question) return null;
    const byId = maps.byQuestionBankId.get(String(question.id));
    if (byId) return byId;
    if (question.question_text) {
      return maps.byQuestionText.get(question.question_text.trim().toLowerCase()) || null;
    }
    return null;
  }

  function isMissingSchemaItem(error, itemName) {
    const code = error?.code || '';
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    const needle = itemName.toLowerCase();
    return (
      message.includes(needle) &&
      (code === 'PGRST204' || code === 'PGRST205' || code === '42703' || code === '42P01' || message.includes('schema cache') || message.includes('does not exist') || message.includes('could not find'))
    );
  }

  function isMissingStudentResponsesError(error) {
    return isMissingSchemaItem(error, 'student_responses');
  }

  async function fetchResultRow(resultId) {
    let { data, error } = await window.supabaseClient
      .from('student_results')
      .select('id, quiz_id, student_name, score, total_questions, completed_at, response_snapshot')
      .eq('id', resultId)
      .maybeSingle();

    if (error && isMissingSchemaItem(error, 'response_snapshot')) {
      ({ data, error } = await window.supabaseClient
        .from('student_results')
        .select('id, quiz_id, student_name, score, total_questions, completed_at')
        .eq('id', resultId)
        .maybeSingle());

      if (data) data.response_snapshot = [];
    }

    if (error) throw error;
    return data;
  }

  function normalizeResponseSnapshot(snapshot, resultRow) {
    if (!Array.isArray(snapshot)) return [];

    return snapshot.map((item) => ({
      quiz_id: item.quiz_id || resultRow?.quiz_id,
      student_result_id: resultRow?.id,
      student_name: resultRow?.student_name || '',
      question_text: item.question_text || '',
      question_bank_id: item.question_bank_id || item.question_id || null,
      student_answer: item.student_answer ?? item.answer ?? '',
      question_type: item.question_type || item.type || 'MCQ',
      marks_assigned: item.marks_assigned ?? null,
      ai_reasoning: item.ai_reasoning ?? null,
    }));
  }

  function getLocalResponseSnapshot(resultId, resultRow) {
    try {
      const stored = JSON.parse(localStorage.getItem('quiz_response_snapshots') || '{}');
      const directEntry = stored[String(resultId)];
      if (directEntry?.responses) {
        return normalizeResponseSnapshot(directEntry.responses, resultRow);
      }

      const latestKey = `latest:${resultRow?.quiz_id}:${resultRow?.student_name}`;
      const latestEntry = stored[latestKey];
      if (latestEntry?.responses) {
        return normalizeResponseSnapshot(latestEntry.responses, resultRow);
      }

      const matchingEntry = Object.values(stored)
        .filter((entry) => entry?.quiz_id === resultRow?.quiz_id && entry?.student_name === resultRow?.student_name)
        .sort((a, b) => new Date(b?.saved_at || 0) - new Date(a?.saved_at || 0))[0];

      return normalizeResponseSnapshot(matchingEntry?.responses, resultRow);
    } catch (err) {
      console.warn('Could not read local response snapshot:', err);
      return [];
    }
  }

  async function fetchStudentResponses(resultId, quizId, studentName) {
    const { data: linkedResponses, error: linkedError } = await window.supabaseClient
      .from('student_responses')
      .select('*')
      .eq('student_result_id', resultId);

    if (linkedError) {
      if (isMissingStudentResponsesError(linkedError)) return [];
      throw linkedError;
    }

    if (linkedResponses && linkedResponses.length > 0) {
      return linkedResponses;
    }

    if (!quizId || !studentName) return [];

    const { data: fallbackResponses, error: fallbackError } = await window.supabaseClient
      .from('student_responses')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('student_name', studentName)
      .order('created_at', { ascending: false });

    if (fallbackError) {
      if (isMissingStudentResponsesError(fallbackError)) return [];
      throw fallbackError;
    }

    return fallbackResponses || [];
  }
  function evaluateQuestionGrade(questionType, studentResp, question) {
    const typeKey = normalizeQuestionType(questionType);
    const rawStudent = studentResp ? String(studentResp.student_answer || '').trim() : '';
    const cleanStudentAns = rawStudent.toLowerCase();

    let correctAnswer = '';
    let studentCompare = rawStudent;
    let correctCompare = '';
    let isCorrect = false;
    let countsTowardAutoScore = false;

    if (typeKey === 'MCQ') {
      countsTowardAutoScore = true;
      const studentLetter = normalizeMcqLetter(rawStudent, question);
      const correctLetter = getMcqCorrectLetter(question);
      correctAnswer = correctLetter;
      studentCompare = studentLetter;
      correctCompare = correctLetter;
      isCorrect = Boolean(rawStudent && studentLetter && correctLetter && studentLetter.toUpperCase() === correctLetter.toUpperCase());
    } else if (typeKey === 'FIB') {
      countsTowardAutoScore = true;
      correctAnswer = String(question.correct_option || '').trim();
      studentCompare = rawStudent;
      correctCompare = correctAnswer;
      const cleanCorrectAns = correctAnswer.toLowerCase();
      isCorrect = Boolean(cleanStudentAns && cleanCorrectAns && cleanStudentAns === cleanCorrectAns);
    } else {
      countsTowardAutoScore = true;
      correctAnswer = String(question.correct_option || '').trim();
      studentCompare = rawStudent;
      correctCompare = correctAnswer;
      const cleanCorrectAns = correctAnswer.toLowerCase();
      isCorrect = Boolean(cleanStudentAns && cleanCorrectAns && cleanStudentAns === cleanCorrectAns);

      const manualMarks = studentResp?.marks_assigned;
      if (manualMarks != null && Number(manualMarks) > 0) {
        isCorrect = true;
      }
    }

    return {
      studentAnswer: rawStudent,
      correctAnswer,
      studentCompare,
      correctCompare,
      isCorrect,
      countsTowardAutoScore,
      questionType: typeKey,
    };
  }

  function renderAnswerBox(label, value, colorClass, emptyText = 'Student not enter') {
    const displayValue = (value == null ? '' : String(value).trim()) || emptyText;

    return `
      <div class="p-4 rounded-xl border-2 ${colorClass}">
        <span class="text-xs font-bold uppercase tracking-wider block mb-2">${label}</span>
        <span class="text-sm font-semibold whitespace-pre-wrap break-words">${escapeHtml(displayValue)}</span>
      </div>
    `;
  }

  function formatMcqAnswerLabel(letter, question) {
    const answerLetter = String(letter || '').trim().toUpperCase();
    if (!answerLetter) return '';

    const optionText = question[`option_${answerLetter.toLowerCase()}`];
    if (!optionText) return answerLetter;

    return `${answerLetter}. ${optionText}`;
  }

  function renderMcqReviewCard(displayNumber, questionText, question, studentLetter, correctLetter) {
    let optionsHtml = '';
    const answeredCorrectly = studentLetter && correctLetter && studentLetter === correctLetter;
    const studentAnswerLabel = formatMcqAnswerLabel(studentLetter, question);
    const correctAnswerLabel = formatMcqAnswerLabel(correctLetter, question);

    ['A', 'B', 'C', 'D'].forEach((letter) => {
      const optionText = question[`option_${letter.toLowerCase()}`];
      if (!optionText) return;

      let containerClasses = 'bg-white border border-slate-200';
      let labelText = '';

      if (letter === studentLetter && letter === correctLetter) {
        containerClasses = 'bg-emerald-50 border-2 border-emerald-400';
        labelText = '<span class="text-xs font-bold text-emerald-700">Correct and student answer</span>';
      } else if (letter === studentLetter && letter !== correctLetter) {
        containerClasses = 'bg-rose-50 border-2 border-rose-400';
        labelText = '<span class="text-xs font-bold text-rose-700">Student answer</span>';
      } else if (letter === correctLetter && letter !== studentLetter) {
        containerClasses = 'bg-emerald-50 border-2 border-emerald-400';
        labelText = '<span class="text-xs font-bold text-emerald-700">Correct answer</span>';
      }

      const badgeBg = containerClasses.includes('emerald')
        ? 'bg-emerald-200 text-emerald-800'
        : containerClasses.includes('rose')
          ? 'bg-rose-200 text-rose-800'
          : 'bg-slate-100 text-slate-500';
      const textClass = containerClasses.includes('emerald')
        ? 'text-emerald-800 font-semibold'
        : containerClasses.includes('rose')
          ? 'text-rose-800 font-semibold'
          : 'text-slate-700';

      optionsHtml += `
        <div class="flex flex-col gap-1.5 p-3 rounded-xl ${containerClasses}">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${badgeBg}">${letter}</span>
            <span class="text-sm ${textClass} flex-1 break-words">${escapeHtml(optionText)}</span>
          </div>
          ${labelText ? `<div class="pl-10">${labelText}</div>` : ''}
        </div>
      `;
    });

    return `
      <div class="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
        <div class="flex items-start gap-3 mb-4">
          <span class="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-100 text-blue-700 text-sm font-bold shrink-0">${displayNumber}</span>
          <h4 class="text-sm font-bold text-slate-900 flex-1 leading-relaxed pt-1">${escapeHtml(questionText)}</h4>
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 shrink-0">MCQ</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          ${renderAnswerBox(
            'Student Answer',
            studentAnswerLabel,
            answeredCorrectly ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-rose-400 bg-rose-50 text-rose-900'
          )}
          ${renderAnswerBox(
            'Correct Answer',
            correctAnswerLabel,
            'border-emerald-400 bg-emerald-50 text-emerald-900',
            'No correct answer set'
          )}
        </div>
        <div class="grid grid-cols-1 gap-2">${optionsHtml}</div>
      </div>
    `;
  }

  function renderFibReviewCard(displayNumber, questionText, studentAnswer, correctAnswer, isCorrect) {
    return `
      <div class="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
        <div class="flex items-start gap-3 mb-4">
          <span class="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-100 text-blue-700 text-sm font-bold shrink-0">${displayNumber}</span>
          <h4 class="text-sm font-bold text-slate-900 flex-1 leading-relaxed pt-1">${escapeHtml(questionText)}</h4>
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-violet-50 text-violet-600 border border-violet-100 shrink-0">Fill in the Blanks</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${renderAnswerBox(
            'Student Answer',
            studentAnswer,
            isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-rose-400 bg-rose-50 text-rose-900'
          )}
          ${renderAnswerBox(
            'Correct Answer',
            correctAnswer,
            'border-emerald-400 bg-emerald-50 text-emerald-900',
            'No correct answer set'
          )}
        </div>
      </div>
    `;
  }

  function renderShortAnswerReviewCard(displayNumber, questionText, studentAnswer, correctAnswer, isCorrect) {
    return `
      <div class="border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
        <div class="flex items-start gap-3 mb-4">
          <span class="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-100 text-blue-700 text-sm font-bold shrink-0">${displayNumber}</span>
          <h4 class="text-sm font-bold text-slate-900 flex-1 leading-relaxed pt-1">${escapeHtml(questionText)}</h4>
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100 shrink-0">Short Answer</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${renderAnswerBox(
            'Student Answer',
            studentAnswer,
            isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-rose-400 bg-rose-50 text-rose-900'
          )}
          ${renderAnswerBox(
            'Correct Answer',
            correctAnswer,
            'border-emerald-400 bg-emerald-50 text-emerald-900',
            'No correct answer set'
          )}
        </div>
      </div>
    `;
  }
  // Open Question Review Modal
  async function openQuestionReviewModal(submissionId, studentName, quizTitle, quizId) {
    const resultId = String(submissionId).trim();

    questionReviewTitle.textContent = `Review Responses: ${studentName} - ${quizTitle}`;
    questionReviewContent.innerHTML = `
      <div class="py-8 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    `;
    questionReviewModal.classList.remove('hidden');

    try {
      const resultRow = await fetchResultRow(resultId);
      const resolvedQuizId = quizId || resultRow?.quiz_id;
      const resolvedStudentName = studentName || resultRow?.student_name || '';

      const { data: quizQuestions, error: qqError } = await window.supabaseClient
        .from('quiz_questions')
        .select('*, question_bank(*)')
        .eq('quiz_id', resolvedQuizId);

      if (qqError) throw qqError;

      const snapshotResponses = normalizeResponseSnapshot(resultRow?.response_snapshot, resultRow);
            const tableResponses = await fetchStudentResponses(resultId, resolvedQuizId, resolvedStudentName);
                  const localResponses = snapshotResponses.length === 0 && tableResponses.length === 0
              ? getLocalResponseSnapshot(resultId, resultRow)
              : [];
            // Merge grading data from student_responses into snapshot, so manual grades
            // (marks_assigned, ai_reasoning) survive even when response_snapshot is present.
            if (snapshotResponses.length > 0 && tableResponses.length > 0) {
              const tableMap = new Map();
              tableResponses.forEach(r => { const k = (r.question_text || '').trim().toLowerCase(); if (k) tableMap.set(k, r); });
              snapshotResponses.forEach(r => {
                const k = (r.question_text || '').trim().toLowerCase();
                const tr = k ? tableMap.get(k) : null;
                if (tr) {
                  if (tr.marks_assigned != null) r.marks_assigned = tr.marks_assigned;
                  if (tr.ai_reasoning) r.ai_reasoning = tr.ai_reasoning;
                }
              });
            }
            const responses = snapshotResponses.length > 0
              ? snapshotResponses
              : (tableResponses.length > 0 ? tableResponses : localResponses);
      const responseMaps = buildResponseLookupMaps(responses);

      if (!quizQuestions || quizQuestions.length === 0) {
        questionReviewContent.innerHTML = `
          <div class="py-8 text-center">
            <i data-lucide="alert-circle" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
            <p class="text-slate-500">No questions found for this quiz.</p>
          </div>
        `;
        window.lucide.createIcons();
        return;
      }

      const questions = quizQuestions
        .map((qq) => qq.question_bank)
        .filter(Boolean);

      let totalCorrect = 0;
      let autoGradableCount = 0;

      const processedQuestions = questions.map((q, index) => {
        const studentResp = findStudentResponse(q, responseMaps);
        const grade = evaluateQuestionGrade(q.type || studentResp?.question_type, studentResp, q);

        if (grade.countsTowardAutoScore) {
          autoGradableCount++;
          if (grade.isCorrect) {
            totalCorrect++;
          }
        }

        return {
          q,
          index,
          ...grade,
        };
      });

      const savedScore = Number(resultRow?.score);
      const savedTotal = Number(resultRow?.total_questions);
      const scoreNumerator = Number.isFinite(savedScore) ? savedScore : totalCorrect;
      const scoreDenominator = Number.isFinite(savedTotal) && savedTotal > 0
        ? savedTotal
        : (autoGradableCount > 0 ? autoGradableCount : questions.length);
      const scorePct = scoreDenominator > 0 ? Math.round((scoreNumerator / scoreDenominator) * 100) : 0;
      const scorePctColor = scorePct >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                            scorePct >= 60 ? 'text-blue-700 bg-blue-50 border-blue-200' :
                            scorePct >= 40 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                             'text-rose-700 bg-rose-50 border-rose-200';

      let contentHtml = `
        <div class="flex items-center justify-between p-4 rounded-xl border ${scorePctColor} mb-5">
          <div class="flex items-center gap-3">
            <span class="text-2xl font-black">${scoreNumerator}</span>
            <span class="text-sm font-semibold opacity-80">/ ${scoreDenominator} correct</span>
          </div>
          <span class="text-lg font-extrabold">${scorePct}%</span>
        </div>
      `;

      processedQuestions.forEach((item) => {
        const { q, index, questionType, studentAnswer, correctAnswer, studentCompare, correctCompare, isCorrect } = item;
        const displayNumber = index + 1;
        const questionText = q.question_text || '';

        if (questionType === 'MCQ') {
          contentHtml += renderMcqReviewCard(
            displayNumber,
            questionText,
            q,
            studentCompare,
            correctCompare
          );
        } else if (questionType === 'FIB') {
          contentHtml += renderFibReviewCard(
            displayNumber,
            questionText,
            studentAnswer,
            correctAnswer,
            isCorrect
          );
        } else {
          contentHtml += renderShortAnswerReviewCard(
            displayNumber,
            questionText,
            studentAnswer,
            correctAnswer,
            isCorrect
          );
        }
      });

      questionReviewContent.innerHTML = `<div class="space-y-4">${contentHtml}</div>`;
      window.lucide.createIcons();
    } catch (err) {
      console.error('Error loading question review:', err);
      questionReviewContent.innerHTML = `
        <div class="py-8 text-center">
          <i data-lucide="alert-circle" class="w-12 h-12 text-rose-400 mx-auto mb-3"></i>
          <h4 class="text-sm font-bold text-rose-800">Failed to load questions</h4>
          <p class="text-rose-600 text-sm mt-1">${escapeHtml(err.message)}</p>
        </div>
      `;
      window.lucide.createIcons();
    }
  }
  // Event delegation for btn-view-responses in reports container
  reportsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-responses');
    if (!btn) return;

    const submissionId = btn.dataset.submissionId;
    const result = results.find((r) => String(r.id) === String(submissionId));
    if (!result) {
      window.showToast('Submission not found', 'warning');
      return;
    }

    openQuestionReviewModal(
      result.id,
      result.student_name,
      result.quizzes?.title || 'Unknown Quiz',
      result.quiz_id
    );
  });

  // Event delegation for btn-view-responses in student history modal
  studentHistoryModal.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view-responses');
    if (!btn) return;

    const submissionId = btn.dataset.submissionId;
    const result = results.find((r) => String(r.id) === String(submissionId));
    if (!result) {
      window.showToast('Submission not found', 'warning');
      return;
    }

    openQuestionReviewModal(
      result.id,
      result.student_name,
      result.quizzes?.title || 'Unknown Quiz',
      result.quiz_id
    );
  });

  const detailedCsvHeaders = [
    'submission_id',
    'quiz_code',
    'student_name',
    'quiz_title',
    'completed_at',
    'current_score',
    'total_questions',
    'percentage',
    'question_index',
    'question_type',
    'question_text',
    'student_answer',
    'correct_key',
    'assigned_marks',
    'ai_reasoning'
  ];

  function rowsToCsv(rows) {
    return rows
      .map((row) =>
        row
          .map((val) => {
            const escaped = (val == null ? '' : String(val)).replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');
  }

  function buildAiGradingPrompt(csvContent) {
    return [
      'AI GRADING PROMPT FOR CHATGPT/GEMINI',
      'You are grading quiz submissions for a teacher.',
      'Use the INPUT CSV below. Each input row is one question from one student submission.',
      'Rows repeat student and quiz details; group rows by submission_id. question_index starts at 1 for each student.',
      'For MCQ questions, use the correct_key and student_answer to decide correctness.',
      'For FIB and SHORT_ANSWER questions, compare the student_answer with correct_key and give credit only when the meaning is correct.',
      'The quiz website needs a paste-back grading CSV. Return exactly one output row per submission_id, not one row per question.',
      'Return ONLY raw CSV text. Do not use markdown, code fences, headings, bullets, or extra explanation.',
      'The returned CSV must have exactly this header and only these three columns:',
      'submission_id,score,ai_reasoning',
      'score must be a whole number from 0 to total_questions and must be the final total correct answers for that submission.',
      'ai_reasoning should be a short note about the grading decision. If it contains commas, wrap it in CSV quotes.',
      '',
      'INPUT CSV:',
      csvContent
    ].join('\n');
  }
  function extractCsvSection(rawText, requiredHeaders = ['submission_id']) {
    const lines = String(rawText || '')
      .replace(/```(?:csv)?/gi, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const headerIndex = lines.findIndex((line) => {
      const lower = line.toLowerCase();
      return requiredHeaders.every((header) => lower.includes(header.toLowerCase()));
    });

    return (headerIndex >= 0 ? lines.slice(headerIndex) : lines).join('\n');
  }

  function extractAiGradesCsvSection(rawText) {
    const lines = String(rawText || '')
      .replace(/```(?:csv)?/gi, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const headerIndexes = [];
    lines.forEach((line, index) => {
      const cols = parseCsvLine(line).map((col) => col.trim().replace(/^"|"$/g, '').toLowerCase());
      if (cols.includes('submission_id') && cols.includes('score') && cols.includes('ai_reasoning')) {
        headerIndexes.push(index);
      }
    });

    if (headerIndexes.length === 0) return '';

    const headerIndex = headerIndexes[headerIndexes.length - 1];
    const section = [lines[headerIndex]];
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i]);
      const submissionId = (row[0] || '').trim();
      const score = (row[1] || '').trim();
      if (uuidPattern.test(submissionId) && /^\d+$/.test(score)) {
        section.push(lines[i]);
      }
    }

    return section.length > 1 ? section.join('\n') : '';
  }
  function getCurrentlyFilteredResults() {
    let filtered = results;
    if (filterQuizCode) {
      filtered = filtered.filter(r => (r.quizzes?.access_code || '').toUpperCase() === filterQuizCode.toUpperCase());
    }
    if (filterDate) {
      const dateParts = filterDate.split('-');
      if (dateParts.length === 3 && dateParts[0].length === 4) {
        filtered = filtered.filter(r => new Date(r.completed_at).toISOString().split('T')[0] === filterDate);
      }
    }
    if (filterTime) {
      const timeParts = filterTime.split(':');
      if (timeParts.length === 2 && timeParts[0].length === 2) {
        filtered = filtered.filter(r => {
          const d = new Date(r.completed_at);
          return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') === filterTime;
        });
      }
    }
    return filtered;
  }

  function mergeTableGradesIntoSnapshot(snapshotResponses, tableResponses) {
    if (snapshotResponses.length === 0 || tableResponses.length === 0) return;

    const tableMap = new Map();
    tableResponses.forEach((resp) => {
      const key = (resp.question_text || '').trim().toLowerCase();
      if (key) tableMap.set(key, resp);
    });

    snapshotResponses.forEach((resp) => {
      const key = (resp.question_text || '').trim().toLowerCase();
      const tableResp = key ? tableMap.get(key) : null;
      if (!tableResp) return;
      if (tableResp.marks_assigned != null) resp.marks_assigned = tableResp.marks_assigned;
      if (tableResp.ai_reasoning) resp.ai_reasoning = tableResp.ai_reasoning;
    });
  }

  async function buildDetailedCsvRowsForResult(result) {
    const submissionId = result.id;
    const resultRow = await fetchResultRow(submissionId);
    const resultContext = resultRow || result;
    const quizId = result.quiz_id || resultRow?.quiz_id;
    const resolvedStudentName = resultRow?.student_name || result.student_name || '';
    const quizTitle = result.quizzes?.title || 'Unknown Quiz';
    const quizCode = result.quizzes?.access_code || '';

    if (!quizId) return [];

    const { data: quizQuestions, error: qqError } = await window.supabaseClient
      .from('quiz_questions')
      .select('*, question_bank(*)')
      .eq('quiz_id', quizId);

    if (qqError) throw qqError;

    const snapshotResponses = normalizeResponseSnapshot(resultRow?.response_snapshot, resultContext);
    const tableResponses = await fetchStudentResponses(submissionId, quizId, resolvedStudentName);
    const localResponses = snapshotResponses.length === 0 && tableResponses.length === 0
      ? getLocalResponseSnapshot(submissionId, resultContext)
      : [];

    mergeTableGradesIntoSnapshot(snapshotResponses, tableResponses);

    const responses = snapshotResponses.length > 0
      ? snapshotResponses
      : (tableResponses.length > 0 ? tableResponses : localResponses);
    const responseMaps = buildResponseLookupMaps(responses);
    const currentScore = Number(resultRow?.score ?? result.score ?? 0);
    const totalQuestions = Number(resultRow?.total_questions ?? result.total_questions ?? 0);
    const percentage = totalQuestions > 0 ? Math.round((currentScore / totalQuestions) * 100) : 0;

    return (quizQuestions || []).map((qq, qIndex) => {
      const question = qq.question_bank;
      if (!question) return null;

      const studentResp = findStudentResponse(question, responseMaps);
      const questionType = normalizeQuestionType(question.type || studentResp?.question_type);
      const rawStudentAnswer = studentResp ? String(studentResp.student_answer || '').trim() : '';
      const studentAnswer = questionType === 'MCQ'
        ? formatMcqAnswerLabel(normalizeMcqLetter(rawStudentAnswer, question), question)
        : rawStudentAnswer;
      const correctKey = questionType === 'MCQ'
        ? formatMcqAnswerLabel(getMcqCorrectLetter(question), question)
        : (question.correct_option || '');

      return [
        submissionId,
        quizCode,
        resolvedStudentName,
        quizTitle,
        resultRow?.completed_at || result.completed_at || '',
        currentScore,
        totalQuestions,
        percentage,
        qIndex + 1,
        questionType,
        question.question_text || '',
        studentAnswer,
        correctKey,
        studentResp?.marks_assigned ?? '',
        studentResp?.ai_reasoning || ''
      ];
    }).filter(Boolean);
  }

  async function buildDetailedCsvTextForResults(list, includeAiPrompt = true) {
    const allRows = [detailedCsvHeaders];
    for (const result of list) {
      const rows = await buildDetailedCsvRowsForResult(result);
      allRows.push(...rows);
    }

    const csvContent = rowsToCsv(allRows);
    return includeAiPrompt ? buildAiGradingPrompt(csvContent) : csvContent;
  }
  // Event delegation for copy CSV buttons
  reportsContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-csv-btn');
    if (btn) {
      await handleCopyCsv(btn);
    }
  });

  // Event delegation for Apply Filter button and Copy All CSV
  reportsContainer.addEventListener('click', async (e) => {
    if (e.target.id === 'btnApplyDateTimeFilter') {
      const quizCodeInput = document.getElementById('filterQuizCode');
      const dateInput = document.getElementById('filterDateInput');
      const timeInput = document.getElementById('filterTimeInput');
      filterQuizCode = quizCodeInput ? quizCodeInput.value.trim() : '';
      filterDate = dateInput ? dateInput.value : '';
      filterTime = timeInput ? timeInput.value : '';
      filterAndRender();
    } else if (e.target.id === 'btnClearDateTimeFilter') {
      filterQuizCode = '';
      filterDate = '';
      filterTime = '';
      filterAndRender();
    } else if (e.target.id === 'btnCopyAllCsv') {
      const btn = e.target;
      const originalText = btn.textContent;
      btn.textContent = 'Building...';
      btn.disabled = true;

      try {
        const filtered = getCurrentlyFilteredResults();
        if (filtered.length === 0) {
          window.showToast('No records to copy', 'warning');
          return;
        }

        const csvContent = await buildDetailedCsvTextForResults(filtered, true);
        await navigator.clipboard.writeText(csvContent);
        window.showToast('Detailed AI CSV prompt copied!', 'success');
      } catch (err) {
        console.error('Error copying all CSV:', err);
        window.showToast(err.message || 'Failed to copy all CSV', 'error');
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }
  });

  // View CSV Button Handler
  btnViewCsvPlain.addEventListener('click', () => {
    const rawText = manualCsvInput.value.trim();
    console.log('📥 btnViewCsvPlain clicked! rawText:', rawText);
    if (!rawText) {
      window.showToast('Please paste CSV text first', 'warning');
      return;
    }

    try {
      // Parse CSV lines, trim whitespace. Accept both header + rows and rows only.
      const csvText = extractCsvSection(rawText, ['submission_id', 'question_text']);
      const lines = csvText.split('\n').filter(line => line.trim());
      console.log('CSV lines array:', lines);
      if (lines.length < 1) {
        window.showToast('CSV must have at least one data row', 'warning');
        return;
      }

      const defaultHeaders = [
        'submission_id',
        'student_name',
        'quiz_title',
        'question_text',
        'question_index',
        'student_answer',
        'correct_key',
        'assigned_marks',
        'ai_reasoning'
      ];

      let headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
      const hasHeader = defaultHeaders.some((header) => headers.includes(header));
      let rowStartIndex = 1;
      if (!hasHeader) {
        headers = defaultHeaders;
        rowStartIndex = 0;
      }

      console.log('CSV headers:', headers);
      const dataRows = [];
      for (let i = rowStartIndex; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        console.log(`line ${i} parsed row:`, row);
        if (row.length > 0) {
          dataRows.push(row);
        }
      }

      console.log('CSV dataRows:', dataRows);
      if (dataRows.length === 0) {
        window.showToast('No data rows found in CSV', 'warning');
        return;
      }

      const getCell = (row, fieldName) => {
        const idx = headers.indexOf(fieldName);
        return idx >= 0 ? (row[idx] || '') : '';
      };

      const groupedMap = new Map();
      dataRows.forEach((row, rowIndex) => {
        const submissionId = getCell(row, 'submission_id') || `row-${rowIndex}`;
        if (!groupedMap.has(submissionId)) {
          groupedMap.set(submissionId, {
            submissionId,
            quizId: getCell(row, 'quiz_id'),
            quizCode: getCell(row, 'quiz_code'),
            studentName: getCell(row, 'student_name'),
            quizTitle: getCell(row, 'quiz_title'),
            completedAt: getCell(row, 'completed_at'),
            currentScore: getCell(row, 'current_score'),
            totalQuestions: getCell(row, 'total_questions'),
            percentage: getCell(row, 'percentage'),
            questions: [],
          });
        }

        const group = groupedMap.get(submissionId);
        const qIndex = getCell(row, 'question_index');
        const questionText = getCell(row, 'question_text');

        if (questionText || getCell(row, 'student_answer') || getCell(row, 'correct_key')) {
          group.questions.push({
            questionIndex: qIndex,
            questionType: getCell(row, 'question_type'),
            questionText,
            studentAnswer: getCell(row, 'student_answer'),
            correctKey: getCell(row, 'correct_key'),
            assignedMarks: getCell(row, 'assigned_marks'),
            aiReasoning: getCell(row, 'ai_reasoning')
          });
        }
      });

      const submissionGroups = Array.from(groupedMap.values()).map((group) => ({
        ...group,
        questions: group.questions.sort((a, b) => {
          const aIndex = parseInt(a.questionIndex, 10);
          const bIndex = parseInt(b.questionIndex, 10);
          if (Number.isNaN(aIndex) || Number.isNaN(bIndex)) return 0;
          return aIndex - bIndex;
        })
      }));

      if (submissionGroups.length === 0) {
        window.showToast('No question rows found in CSV', 'warning');
        return;
      }

      console.log('Submission groups:', submissionGroups);

      const firstGroup = submissionGroups[0];
      currentCsvData = submissionGroups.length === 1 ? {
        submissionId: firstGroup.submissionId,
        studentName: firstGroup.studentName,
        quizTitle: firstGroup.quizTitle,
        questions: firstGroup.questions,
        rawText,
        dataRows,
        headers
      } : null;

      const renderQuestionHtml = (q, idx) => `
        <div class="border border-slate-200 rounded-lg p-3 bg-white">
          <p class="text-xs font-semibold text-slate-700 mb-1">Question ${idx + 1}</p>
          ${q.questionType ? `<p class="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">${escapeHtml(q.questionType)}</p>` : ''}
          <p class="text-xs text-slate-900 mb-2">${escapeHtml(q.questionText)}</p>
          <p class="text-xs"><span class="font-semibold text-slate-600">Student Answer:</span> ${(q.studentAnswer && q.studentAnswer.trim()) ? escapeHtml(q.studentAnswer) : '<em class="text-slate-400">Student not enter</em>'}</p>
          <p class="text-xs"><span class="font-semibold text-slate-600">Correct Answer:</span> ${escapeHtml(q.correctKey)}</p>
        </div>
      `;

      const groupsHtml = submissionGroups.map((group, groupIndex) => `
        <div class="border border-slate-200 rounded-xl bg-white/70 p-3 space-y-3">
          <div class="text-xs space-y-1.5">
            <p class="font-bold text-slate-800">Student ${groupIndex + 1}</p>
            <p><span class="font-semibold text-slate-600">Student:</span> ${escapeHtml(group.studentName)}</p>
            <p><span class="font-semibold text-slate-600">Quiz:</span> ${escapeHtml(group.quizTitle)}</p>
            ${group.quizCode ? `<p><span class="font-semibold text-slate-600">Quiz Code:</span> <span class="font-mono">${escapeHtml(group.quizCode)}</span></p>` : ''}
            ${group.currentScore || group.totalQuestions ? `<p><span class="font-semibold text-slate-600">Score:</span> ${escapeHtml(group.currentScore || '0')} / ${escapeHtml(group.totalQuestions || String(group.questions.length))}</p>` : ''}
          </div>
          <div class="pt-2 border-t border-slate-200">
            <h4 class="text-xs font-semibold text-slate-700 mb-2">Questions (${group.questions.length})</h4>
            <div class="space-y-2">
              ${group.questions.map(renderQuestionHtml).join('')}
            </div>
          </div>
        </div>
      `).join('');

      const canManualGrade = submissionGroups.length === 1;

      csvPlainPreview.innerHTML = `
        <div class="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            Plain Text Preview
          </h3>
          <div class="pt-2 border-t border-slate-200">
            <h4 class="text-xs font-semibold text-slate-700 mb-2">${submissionGroups.length === 1 ? `Questions (${firstGroup.questions.length})` : `Submissions (${submissionGroups.length})`}</h4>
            <div class="space-y-3 max-h-64 overflow-y-auto">
              ${groupsHtml}
            </div>
          </div>
          ${canManualGrade ? `
            <div class="pt-2 border-t border-slate-200">
              <label class="text-xs font-semibold text-slate-700 block mb-1.5">Enter Grades (question number + grade, e.g., "2 C, 4 5"):</label>
              <textarea id="manualMarksGiven" rows="3" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y" placeholder="2 C&#10;4 5"></textarea>
            </div>
          ` : ''}
        </div>
      `;
      window.lucide.createIcons();
      btnSubmitCsvGrade.disabled = !canManualGrade;
    } catch (err) {
      console.error('Error parsing CSV:', err);
      window.showToast('Error parsing CSV: ' + err.message, 'error');
    }
  });

  // Submit CSV Grade Button Handler
  btnSubmitCsvGrade.addEventListener('click', async () => {
    if (!currentCsvData) {
      window.showToast('Please view the CSV first', 'warning');
      return;
    }

    const marksInput = document.getElementById('manualMarksGiven');
    const gradesStr = marksInput ? marksInput.value.trim() : '';

    let gradeEntries;
    try {
      gradeEntries = parseManualGradeEntries(gradesStr, currentCsvData.questions.length);
    } catch (err) {
      window.showToast(err.message, 'warning');
      return;
    }

    if (gradeEntries.size === 0) {
      window.showToast('Please enter at least one grade, e.g., "2 C" or "4 5"', 'warning');
      return;
    }

    for (const [questionIndex, gradeRaw] of gradeEntries.entries()) {
      const mark = manualGradeToMark(gradeRaw, currentCsvData.questions[questionIndex]);
      if (mark === null || isNaN(mark) || mark < 0 || mark > 5) {
        window.showToast(`Grade for question ${questionIndex + 1} must be a number from 0 to 5 or an alphabet`, 'warning');
        return;
      }
    }

    const originalText = btnSubmitCsvGrade.textContent;
    btnSubmitCsvGrade.disabled = true;
    btnSubmitCsvGrade.textContent = 'Saving...';

    try {
      const resultRow = await fetchResultRow(currentCsvData.submissionId);
      const quizId = resultRow?.quiz_id || null;
      const resolvedStudentName = resultRow?.student_name || currentCsvData.studentName;
      const existingResponses = quizId
        ? await fetchStudentResponses(currentCsvData.submissionId, quizId, resolvedStudentName)
        : [];

      const responseMap = new Map();
      existingResponses.forEach((resp, idx) => {
        if (!resp.question_text) return;
        const qText = resp.question_text.trim().toLowerCase();
        if (!responseMap.has(qText)) {
          responseMap.set(qText, []);
        }
        responseMap.get(qText).push({ id: resp.id, index: idx, response: resp });
      });

      for (const [questionIndex, gradeRaw] of gradeEntries.entries()) {
        const q = currentCsvData.questions[questionIndex];
        const marksToAssign = manualGradeToMark(gradeRaw, q);
        const gradeNote = `Manual grade: ${gradeRaw}`;

        const qTextKey = (q.questionText || '').trim().toLowerCase();
        const responsesForQ = responseMap.get(qTextKey) || [];
        const responseId = responsesForQ[0]?.id || null;

        if (responseId) {
          const { error: updateRespError } = await window.supabaseClient
            .from('student_responses')
            .update({ marks_assigned: marksToAssign, ai_reasoning: gradeNote })
            .eq('id', responseId);

          if (updateRespError) throw updateRespError;
        } else if (quizId) {
          const { error: insertRespError } = await window.supabaseClient
            .from('student_responses')
            .insert({
              quiz_id: quizId,
              student_result_id: currentCsvData.submissionId,
              student_name: resolvedStudentName,
              question_text: q.questionText || '',
              question_bank_id: null,
              student_answer: q.studentAnswer || '',
              question_type: 'Manual',
              marks_assigned: marksToAssign,
              ai_reasoning: gradeNote,
            });

          if (insertRespError) throw insertRespError;
        }
      }

      const correctedCount = calculateManualScore(currentCsvData.questions, gradeEntries);
      const { error: updateResultError } = await window.supabaseClient
        .from('student_results')
        .update({ score: correctedCount })
        .eq('id', currentCsvData.submissionId);

      if (updateResultError) throw updateResultError;

      // Success!
      window.showToast(`Successfully updated marks for ${currentCsvData.studentName}!`, 'success');

      // Clear UI
      manualCsvInput.value = '';
      csvPlainPreview.innerHTML = '';
      btnSubmitCsvGrade.disabled = true;
      currentCsvData = null;

      // Reload data to update UI
      loadReportData();
    } catch (err) {
      console.error('Error updating grade:', err);
      window.showToast(err.message || 'Failed to update grade', 'error');
    } finally {
      btnSubmitCsvGrade.textContent = originalText;
      btnSubmitCsvGrade.disabled = false;
    }
  });

  function parseManualGradeEntries(input, questionCount) {
    const entries = new Map();
    const raw = String(input || '').trim();
    if (!raw) return entries;

    const parts = raw
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const match = part.match(/^(\d+)\s+(.+)$/);
      if (!match) {
        throw new Error('Use question number then grade, e.g., "2 C" or "4 5"');
      }

      const questionNumber = parseInt(match[1], 10);
      const grade = match[2].trim();

      if (!questionNumber || questionNumber < 1 || questionNumber > questionCount) {
        throw new Error(`Question number must be between 1 and ${questionCount}`);
      }
      if (!grade) {
        throw new Error(`Missing grade for question ${questionNumber}`);
      }

      entries.set(questionNumber - 1, grade);
    });

    return entries;
  }

  function getLeadingAnswerLetter(value) {
    const match = String(value || '').trim().match(/^([A-D])(?:\b|[.)\s])/i);
    return match ? match[1].toUpperCase() : '';
  }

  function isCsvQuestionCorrect(question) {
    const studentAnswer = String(question.studentAnswer || '').trim();
    const correctAnswer = String(question.correctKey || '').trim();
    if (!studentAnswer || !correctAnswer) return false;

    const studentLetter = getLeadingAnswerLetter(studentAnswer);
    const correctLetter = getLeadingAnswerLetter(correctAnswer);
    if (studentLetter && correctLetter) {
      return studentLetter === correctLetter;
    }

    return studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
  }

  function calculateManualScore(questions, gradeEntries) {
    return questions.reduce((score, question, index) => {
      if (gradeEntries.has(index)) {
        return score + (manualGradeToMark(gradeEntries.get(index), question) > 0 ? 1 : 0);
      }
      return score + (isCsvQuestionCorrect(question) ? 1 : 0);
    }, 0);
  }
  function manualGradeToMark(rawGrade, question) {
    const value = String(rawGrade || '').trim();
    if (!value) return null;

    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }

    const gradeLetter = value[0].toUpperCase();
    const correctLetter = String(question.correctKey || '').trim().match(/^([A-D])\b/i)?.[1]?.toUpperCase();
    if (correctLetter) {
      return gradeLetter === correctLetter ? 1 : 0;
    }

    return 1;
  }
  // Helper to parse CSV line (handles quotes)
  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // AI Grading Logic
  let aiGradesData = [];
  function renderAiGradesReview(rows) {
    aiGradesData = rows;
    let valid = true;
    let tableHtml = '';

    aiGradesData.forEach((row) => {
      const id = row['submission_id'] || row.submissionId || row['response_id'] || row.responseId || '';
      const score = row['score'] || row.Score || row['marks_assigned'] || row.marksAssigned || '';
      const aiReasoning = row['ai_reasoning'] || row.aiReasoning || '';

      if (!id || score === '') {
        valid = false;
      }

      tableHtml += `
        <tr>
          <td class="px-3 py-2 font-mono text-slate-700">${escapeHtml(id)}</td>
          <td class="px-3 py-2 font-semibold text-slate-900">${escapeHtml(String(score))}</td>
          <td class="px-3 py-2 text-slate-600 truncate max-w-xs">${escapeHtml(aiReasoning)}</td>
        </tr>
      `;
    });

    aiGradesReviewTable.innerHTML = tableHtml;
    aiGradesReviewContainer.classList.remove('hidden');
    return valid;
  }

  function parseAiGradesCsv(rawText, onComplete, onError) {
    const csvText = extractAiGradesCsvSection(rawText);
    if (!csvText) {
      onComplete([]);
      return;
    }
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => onComplete(results.data || []),
      error: onError
    });
  }

  btnViewAiGrades.addEventListener('click', () => {
    const rawText = aiGradesPasteInput.value.trim();
    if (!rawText) {
      window.showToast('Please paste the graded CSV first', 'warning');
      return;
    }

    parseAiGradesCsv(
      rawText,
      (rows) => {
        if (rows.length === 0) {
          window.showToast('Paste the AI returned CSV only: submission_id,score,ai_reasoning', 'warning');
          return;
        }
        const valid = renderAiGradesReview(rows);
        window.showToast(valid ? 'AI grading preview ready' : 'Some AI grading rows are missing required fields', valid ? 'success' : 'warning');
      },
      (err) => {
        console.error('CSV Parsing Error:', err);
        window.showToast('Error parsing pasted CSV input', 'error');
      }
    );
  });


  btnImportAiGrades.addEventListener('click', () => {
    const rawText = aiGradesPasteInput.value.trim();
    if (!rawText) {
      window.showToast('Please paste the graded CSV first', 'warning');
      return;
    }

    btnImportAiGrades.disabled = true;
    const originalText = btnImportAiGrades.textContent;
    btnImportAiGrades.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Parsing...';
    window.lucide.createIcons();

    // PapaParse the pasted CSV text
    const aiCsvText = extractAiGradesCsvSection(rawText);
    if (!aiCsvText) {
      window.showToast('Paste the AI returned CSV only: submission_id,score,ai_reasoning', 'warning');
      resetAiButton(originalText);
      return;
    }

    Papa.parse(aiCsvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: async (results) => {
        aiGradesData = results.data || [];
        if (aiGradesData.length === 0) {
          window.showToast('Paste the AI returned CSV only: submission_id,score,ai_reasoning', 'warning');
          resetAiButton(originalText);
          return;
        }

        const valid = renderAiGradesReview(aiGradesData);
        if (!valid) {
          window.showToast('Some rows are missing required fields', 'warning');
          resetAiButton(originalText);
          return;
        }

        await processAiGrades();
      },
      error: (err) => {
        console.error('CSV Parsing Error:', err);
        window.showToast('Error parsing pasted CSV input', 'error');
        resetAiButton(originalText);
      }
    });

    function resetAiButton(text) {
      btnImportAiGrades.innerHTML = text;
      btnImportAiGrades.disabled = false;
      btnImportAiGrades.onclick = null;
      btnImportAiGrades.addEventListener('click', initialAiGradesClick);
    }
  });

  // Initial click handler (to be restored after processing)
  function initialAiGradesClick() {
    // This is just to hold the initial click logic
  }

  async function processAiGrades() {
    btnImportAiGrades.disabled = true;
    btnImportAiGrades.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Updating Grades...';
    window.lucide.createIcons();

    try {
      const validGrades = [];
      const errors = [];

      aiGradesData.forEach((row, idx) => {
        const rowNum = idx + 2;
        const submissionId = (row['submission_id'] || row.submissionId || '').trim();
        const scoreRaw = row['score'] || row.Score || row.marks_assigned || row.marksAssigned;
        const aiReasoning = (row['ai_reasoning'] || row.aiReasoning || '').trim();

        if (!submissionId || scoreRaw === undefined || scoreRaw === null) {
          errors.push(`Row ${rowNum}: Missing submission_id or score`);
          return;
        }

        const score = parseInt(scoreRaw, 10);
        if (isNaN(score)) {
          errors.push(`Row ${rowNum}: Invalid score (must be a number)`);
          return;
        }

        validGrades.push({ id: submissionId, score: score, ai_reasoning: aiReasoning });
      });

      if (errors.length > 0) {
        window.showToast(`CSV Validation Failed: ${errors[0]}`, 'error');
        throw new Error('Validation failed');
      }

      // Perform bulk update
      const updatePromises = validGrades.map(async (grade) => {
        const { error } = await window.supabaseClient
          .from('student_results')
          .update({ score: grade.score })
          .eq('id', grade.id);

        if (error) throw error;
      });

      await Promise.all(updatePromises);

      window.showToast(`Successfully imported ${validGrades.length} grades!`, 'success');

      // Reset everything
      aiGradesPasteInput.value = '';
      aiGradesReviewContainer.classList.add('hidden');
      aiGradesData = [];

      btnImportAiGrades.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Import AI Grades (CSV)';
      btnImportAiGrades.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      btnImportAiGrades.classList.add('bg-purple-600', 'hover:bg-purple-700');
      btnImportAiGrades.disabled = false;

      loadReportData(); // Reload data to update UI
    } catch (err) {
      console.error('Error updating AI grades:', err);
      window.showToast(err.message || 'Failed to update grades', 'error');

      // Reset button
      btnImportAiGrades.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Import AI Grades (CSV)';
      btnImportAiGrades.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      btnImportAiGrades.classList.add('bg-purple-600', 'hover:bg-purple-700');
      btnImportAiGrades.disabled = false;
    }
  }

  // Also handle clicks in student history modal
  studentHistoryModal.addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy-csv-btn');
    if (btn) {
      await handleCopyCsv(btn);
    }
  });

  // Handle copying CSV for a submission
  async function handleCopyCsv(btn) {
    const submissionId = btn.dataset.submissionId;
    const result = results.find((r) => String(r.id) === String(submissionId));
    const studentName = btn.dataset.studentName || result?.student_name || '';

    const originalText = btn.textContent;
    btn.textContent = 'Fetching...';
    btn.disabled = true;

    try {
      if (!result) {
        window.showToast('Result not found', 'warning');
        return;
      }

      const csvContent = await buildDetailedCsvTextForResults([result], true);
      await navigator.clipboard.writeText(csvContent);
      window.showToast(`Detailed AI CSV prompt for ${studentName} copied!`, 'success');
    } catch (err) {
      console.error('Error copying CSV:', err);
      window.showToast(err.message || 'Failed to copy CSV', 'error');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }



  // Run initialization
  loadReportData();
});
