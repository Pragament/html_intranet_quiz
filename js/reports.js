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
          // Initialize map with 0 for all quizzes
          quizFibShortCountMap = {};
          quizIds.forEach(id => quizFibShortCountMap[id] = 0);

          // Count FIB/Short Answer
          if (quizQuestions) {
            quizQuestions.forEach(qq => {
              if (qq.question_bank) {
                const qType = qq.question_bank.type || 'MCQ';
                if (qType === 'FIB' || qType === 'Short Answer') {
                  quizFibShortCountMap[qq.quiz_id] = (quizFibShortCountMap[qq.quiz_id] || 0) + 1;
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
      .select('id, quiz_id, student_name, score, total_questions, response_snapshot')
      .eq('id', resultId)
      .maybeSingle();

    if (error && isMissingSchemaItem(error, 'response_snapshot')) {
      ({ data, error } = await window.supabaseClient
        .from('student_results')
        .select('id, quiz_id, student_name, score, total_questions')
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
      const entry = stored[String(resultId)];
      return normalizeResponseSnapshot(entry?.responses, resultRow);
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

      if (!rawStudent || !studentLetter || !correctLetter) {
        isCorrect = false;
      } else {
        isCorrect = studentLetter.toUpperCase() === correctLetter.toUpperCase();
      }
    } else if (typeKey === 'FIB') {
      countsTowardAutoScore = true;
      correctAnswer = String(question.correct_option || '').trim();
      studentCompare = rawStudent;
      correctCompare = correctAnswer;
      const cleanCorrectAns = correctAnswer.toLowerCase();

      if (!cleanStudentAns || !cleanCorrectAns) {
        isCorrect = false;
      } else {
        isCorrect = cleanStudentAns === cleanCorrectAns;
      }
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

  function renderAnswerBox(label, value, colorClass, emptyText = 'No answer provided') {
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
      const tableResponses = snapshotResponses.length > 0
        ? []
        : await fetchStudentResponses(resultId, resolvedQuizId, resolvedStudentName);
      const localResponses = snapshotResponses.length === 0 && tableResponses.length === 0
        ? getLocalResponseSnapshot(resultId, resultRow)
        : [];
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
      // Get currently filtered list
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

      // Build CSV
      const csvRows = [
        ['submission_id', 'student_name', 'quiz_title', 'quiz_code']
      ];
      filtered.forEach(result => {
        const title = result.quizzes?.title || 'Unknown Quiz';
        const code = result.quizzes?.access_code || '';
        csvRows.push([
          result.id,
          result.student_name,
          title,
          code
        ]);
      });

      const csvContent = csvRows
        .map((row) =>
          row
            .map((val) => {
              const escaped = (val || '').toString().replace(/"/g, '""');
              return `"${escaped}"`;
            })
            .join(',')
        )
        .join('\n');

      // Copy to clipboard
      await navigator.clipboard.writeText(csvContent);
      window.showToast('Bulk CSV Copied!', 'success');
    }
  });

  // View CSV Button Handler
  btnViewCsvPlain.addEventListener('click', () => {
    const rawText = manualCsvInput.value.trim();
    if (!rawText) {
      window.showToast('Please paste CSV text first', 'warning');
      return;
    }

    try {
      // Parse CSV (simple comma split, handle quoted fields if needed)
      const lines = rawText.split('\n');
      if (lines.length < 2) {
        window.showToast('CSV must have at least a header and one data row', 'warning');
        return;
      }

      // Get headers and first data row
      const headers = parseCsvLine(lines[0]);
      const dataRow = parseCsvLine(lines[1]);

      const submissionId = dataRow[headers.indexOf('submission_id')] || '';
      const studentName = dataRow[headers.indexOf('student_name')] || '';
      const quizTitle = dataRow[headers.indexOf('quiz_title')] || '';
      const questionText = dataRow[headers.indexOf('question_text')] || '';
      const studentAnswer = dataRow[headers.indexOf('student_answer')] || '';
      const correctKey = dataRow[headers.indexOf('correct_key')] || '';

      // Store current data for submission
      currentCsvData = {
        submissionId,
        studentName,
        quizTitle,
        questionText,
        studentAnswer,
        correctKey,
        rawText,
        dataRow,
        headers
      };

      // Render preview
      csvPlainPreview.innerHTML = `
        <div class="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4"></i>
            Plain Text Preview
          </h3>
          <div class="text-xs space-y-1.5">
            <p><span class="font-semibold text-slate-600">Student:</span> ${escapeHtml(studentName)}</p>
            <p><span class="font-semibold text-slate-600">Quiz:</span> ${escapeHtml(quizTitle)}</p>
            <p><span class="font-semibold text-slate-600">Question:</span> ${escapeHtml(questionText)}</p>
            <p><span class="font-semibold text-slate-600">Student Answer:</span> ${escapeHtml(studentAnswer)}</p>
            <p><span class="font-semibold text-slate-600">Correct Key:</span> ${escapeHtml(correctKey)}</p>
          </div>
          <div class="pt-2 border-t border-slate-200">
            <label class="text-xs font-semibold text-slate-700 block mb-1.5">Enter Custom Marks (out of 5):</label>
            <input type="number" id="manualMarksGiven" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500" min="0" max="5" placeholder="e.g., 4">
          </div>
        </div>
      `;
      window.lucide.createIcons();

      // Enable Submit button
      btnSubmitCsvGrade.disabled = false;
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
    const marks = marksInput ? parseInt(marksInput.value, 10) : NaN;

    if (isNaN(marks) || marks < 0 || marks > 5) {
      window.showToast('Please enter valid marks between 0 and 5', 'warning');
      return;
    }

    const originalText = btnSubmitCsvGrade.textContent;
    btnSubmitCsvGrade.disabled = true;
    btnSubmitCsvGrade.textContent = 'Saving...';

    try {
      // Get the total questions for this result to calculate percentage
      const existingResult = results.find(r => r.id === currentCsvData.submissionId);
      const totalQuestions = existingResult ? existingResult.total_questions : 1;

      // Update student_results with new score
      const { error: updateError } = await window.supabaseClient
        .from('student_results')
        .update({ score: marks })
        .eq('id', currentCsvData.submissionId);

      if (updateError) throw updateError;

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
    Papa.parse(rawText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        aiGradesData = results.data;
        if (aiGradesData.length === 0) {
          window.showToast('No grading rows found in the pasted CSV', 'warning');
          resetAiButton(originalText);
          return;
        }

        // Validate and show review table
        let valid = true;
        let tableHtml = '';

        aiGradesData.forEach((row, idx) => {
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

        if (!valid) {
          window.showToast('Some rows are missing required fields', 'warning');
        }

        // Change button to "Process Grades"
        btnImportAiGrades.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Process & Update Grades';
        btnImportAiGrades.classList.remove('bg-purple-600', 'hover:bg-purple-700');
        btnImportAiGrades.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

        btnImportAiGrades.onclick = processAiGrades;
        btnImportAiGrades.disabled = false;
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
    const studentName = btn.dataset.studentName;
    const quizTitle = btn.dataset.quizTitle;

    const originalText = btn.textContent;
    btn.textContent = 'Fetching...';
    btn.disabled = true;

    try {
      // Get the result to find quiz ID
      const result = results.find(r => r.id === submissionId);
      if (!result) {
        window.showToast('Result not found', 'warning');
        return;
      }
      const quizId = result.quiz_id;

      // 2. Fetch quiz_questions with question_bank data to get correct_option
      const { data: quizQuestions, error: qqError } = await window.supabaseClient
        .from('quiz_questions')
        .select('*, question_bank(*)')
        .eq('quiz_id', quizId);

      if (qqError) throw qqError;

      // Create a map from question_text to correct_option
      const questionCorrectMap = {};
      if (quizQuestions) {
        quizQuestions.forEach(qq => {
          if (qq.question_bank && qq.question_bank.question_text) {
            questionCorrectMap[qq.question_bank.question_text] = qq.question_bank.correct_option || '';
          }
        });
      }

      // 4. Prepare CSV
      const csvRows = [
        ['submission_id', 'student_name', 'quiz_title', 'question_text', 'student_answer', 'correct_key', 'assigned_marks', 'ai_reasoning']
      ];

      // For each question in the quiz, add a row
      if (quizQuestions) {
        quizQuestions.forEach(qq => {
          if (qq.question_bank) {
            const questionText = qq.question_bank.question_text;
            const correctKey = questionCorrectMap[questionText] || '';
            csvRows.push([
              submissionId,
              studentName,
              quizTitle,
              questionText,
              '',
              correctKey,
              '',
              ''
            ]);
          }
        });
      }

      // 5. Convert to CSV string
      const csvContent = csvRows
        .map((row) =>
          row
            .map((val) => {
              const escaped = (val || '').toString().replace(/"/g, '""');
              return `"${escaped}"`;
            })
            .join(',')
        )
        .join('\n');

      // 6. Copy to clipboard
      await navigator.clipboard.writeText(csvContent);
      window.showToast(`CSV data for ${studentName} copied to clipboard!`, 'success');
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
