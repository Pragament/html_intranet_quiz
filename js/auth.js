// js/auth.js

const DEFAULT_NAMESERVER_URL = 'https://expressjs-api-intranet-nameserver.onrender.com';

// Global HTML Escape Utility
window.escapeHtml = function(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

window.formatQuestionText = function(str) {
  if (!str) return '';

  return window.escapeHtml(str)
    .replace(/`([^`\n]+)`/g, '<code class="formatted-inline-code">$1</code>')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="formatted-frac"><span>$1</span><span>$2</span></span>')
    .replace(/\\overline\{([^{}]+)\}/g, '<span class="formatted-overline">$1</span>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
};

// Initialize Supabase Client from localStorage or window variables
window.initSupabaseFromStorage = function() {
  const storedUrl = localStorage.getItem('SUPABASE_URL');
  const storedKey = localStorage.getItem('SUPABASE_ANON_KEY');

  let url = (storedUrl || window.SUPABASE_URL || '').trim();
  url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');
  const key = (storedKey || window.SUPABASE_ANON_KEY || '').trim();

  if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
    window.SUPABASE_URL = url;
    window.SUPABASE_ANON_KEY = key;
    localStorage.setItem('SUPABASE_URL', url);
    window.supabaseClient = window.supabase.createClient(url, key);
    return window.supabaseClient;
  }
  return null;
};

// Initialize client immediately
window.initSupabaseFromStorage();

// Auto-fetch default configuration if not yet configured in localStorage
window.__autoInitPromise = (async function autoInitConfig() {
  if (!localStorage.getItem('SUPABASE_URL') || !localStorage.getItem('SUPABASE_ANON_KEY')) {
    if (window.DEFAULT_SUPABASE_URL && window.DEFAULT_SUPABASE_ANON_KEY) {
      window.SUPABASE_URL = window.DEFAULT_SUPABASE_URL;
      window.SUPABASE_ANON_KEY = window.DEFAULT_SUPABASE_ANON_KEY;
      localStorage.setItem('SUPABASE_URL', window.DEFAULT_SUPABASE_URL);
      localStorage.setItem('SUPABASE_ANON_KEY', window.DEFAULT_SUPABASE_ANON_KEY);
      return window.initSupabaseFromStorage();
    }
    try {
      const defaultPin = localStorage.getItem('SUPABASE_CONFIG_PIN') || '012345';
      if (typeof window.fetchSupabaseConfig === 'function') {
        await window.fetchSupabaseConfig(defaultPin);
      }
    } catch (e) {
      try {
        if (typeof window.fetchSupabaseConfig === 'function') {
          await window.fetchSupabaseConfig('123456');
        }
      } catch (e2) {
        console.warn('Auto config init skipped:', e2);
      }
    }
  }
  return window.initSupabaseFromStorage();
})();

window.ensureSupabaseClient = async function() {
  if (window.supabaseClient) return window.supabaseClient;
  window.initSupabaseFromStorage();
  if (window.supabaseClient) return window.supabaseClient;
  if (window.__autoInitPromise) {
    try { await window.__autoInitPromise; } catch (e) {}
  }
  return window.initSupabaseFromStorage();
};

// Supabase Config Fetch & Management Logic
window.fetchSupabaseConfig = async function(pin) {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) {
    throw new Error("PIN is required");
  }

  const candidateHosts = [DEFAULT_NAMESERVER_URL];

  // Unique list of hosts
  const uniqueHosts = Array.from(new Set(candidateHosts));
  let result = null;
  let lastError = null;

  for (const host of uniqueHosts) {
    const endpoint = `${host.replace(/\/$/, '')}/api/config/get`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: '', pin: cleanPin }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        if (data && data.success && data.config) {
          result = data;
          break;
        } else if (data && data.error) {
          lastError = new Error(data.error);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        lastError = new Error(errData.error || `Server error (${response.status})`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  if (!result) {
    const isDefaultPin = cleanPin === '012345' || cleanPin === '123456' || cleanPin === 'default';
    const hasDefaultConfig = !!(window.DEFAULT_SUPABASE_URL && window.DEFAULT_SUPABASE_ANON_KEY);

    if (hasDefaultConfig && isDefaultPin) {
      result = {
        success: true,
        config: {
          url: window.DEFAULT_SUPABASE_URL,
          anonKey: window.DEFAULT_SUPABASE_ANON_KEY
        },
        name: 'Default Quiz Platform Config'
      };
    } else {
      throw lastError || new Error('Could not connect to the intranet nameserver for this PIN.');
    }
  }

  if (!result || !result.config) {
    throw new Error('Invalid configuration structure received from server.');
  }

  let url = result.config?.url || result.config?.projectUrl || result.config?.supabaseUrl || result.config?.project_url || window.DEFAULT_SUPABASE_URL;
  url = String(url || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');
  const anonKey = result.config?.anonKey || result.config?.apiKey || result.config?.supabaseAnonKey || result.config?.anon_key || window.DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('No valid Supabase URL or Anon Key found in configuration for this PIN.');
  }

  const configName = result.name || `Config (PIN ${cleanPin})`;

  // Persist to localStorage
  localStorage.setItem('SUPABASE_URL', url);
  localStorage.setItem('SUPABASE_ANON_KEY', anonKey);
  localStorage.setItem('SUPABASE_CONFIG_NAME', configName);
  localStorage.setItem('SUPABASE_CONFIG_PIN', cleanPin);

  // Update in-memory window variables & re-initialize client
  window.SUPABASE_URL = url;
  window.SUPABASE_ANON_KEY = anonKey;
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(url, anonKey);
  }

  return {
    url,
    anonKey,
    name: configName,
    pin: cleanPin
  };
};

window.resetSupabaseConfig = function() {
  localStorage.removeItem('SUPABASE_URL');
  localStorage.removeItem('SUPABASE_ANON_KEY');
  localStorage.removeItem('SUPABASE_CONFIG_NAME');
  localStorage.removeItem('SUPABASE_CONFIG_PIN');
  localStorage.removeItem('SUPABASE_CONFIG_UUID');

  if (window.DEFAULT_SUPABASE_URL && window.DEFAULT_SUPABASE_ANON_KEY) {
    localStorage.setItem('SUPABASE_URL', window.DEFAULT_SUPABASE_URL);
    localStorage.setItem('SUPABASE_ANON_KEY', window.DEFAULT_SUPABASE_ANON_KEY);
  }

  window.SUPABASE_URL = window.DEFAULT_SUPABASE_URL || "";
  window.SUPABASE_ANON_KEY = window.DEFAULT_SUPABASE_ANON_KEY || "";
  if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }
};

// Modal Handler
window.openSupabaseConfigModal = function() {
  let modal = document.getElementById('supabase-config-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supabase-config-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-6 space-y-5 animate-slide-up relative">
        <button id="modal-close-icon" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>

        <div class="flex items-center gap-3">
          <span class="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <i data-lucide="database" class="w-6 h-6"></i>
          </span>
          <div>
            <h3 class="text-lg font-bold text-slate-900">Fetch Supabase Config</h3>
            <p class="text-xs text-slate-500">Enter PIN / OTP to retrieve configuration</p>
          </div>
        </div>

        <div id="modal-status-card" class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
          <div>
            <span class="text-slate-500 font-medium">Status:</span>
            <span id="modal-status-text" class="font-semibold text-slate-800 ml-1">Loading...</span>
          </div>
          <span id="modal-status-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"></span>
        </div>

        <div id="modal-alert" class="hidden p-3.5 rounded-xl text-xs font-medium"></div>

        <form id="modal-config-form" class="space-y-4" autocomplete="off">
          <div>
            <label for="modal-pin" class="block text-xs font-semibold text-slate-700 mb-1">Enter PIN / OTP <span class="text-rose-500">*</span></label>
            <input
              id="modal-pin"
              type="text"
              required
              placeholder="e.g. 888349"
              class="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base font-mono text-center font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="submit"
              id="modal-fetch-btn"
              class="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <i data-lucide="download" class="w-4 h-4"></i>
              <span id="modal-fetch-btn-text">Fetch Config</span>
            </button>
            <button
              type="button"
              id="modal-reset-btn"
              class="py-2.5 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm rounded-xl transition cursor-pointer"
            >
              Reset Default
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    if (window.lucide) window.lucide.createIcons();

    // Event handlers
    const closeBtn = document.getElementById('modal-close-icon');
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    const resetBtn = document.getElementById('modal-reset-btn');
    resetBtn.addEventListener('click', () => {
      window.resetSupabaseConfig();
      window.showToast('Reset to default Supabase configuration.', 'info');
      updateModalStatus();
      window.renderHeader(window.currentUser);
    });

    const form = document.getElementById('modal-config-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = document.getElementById('modal-pin').value;
      const fetchBtn = document.getElementById('modal-fetch-btn');
      const fetchBtnText = document.getElementById('modal-fetch-btn-text');
      const alertBox = document.getElementById('modal-alert');

      alertBox.className = 'hidden';
      fetchBtn.disabled = true;
      fetchBtnText.textContent = 'Fetching...';

      try {
        const res = await window.fetchSupabaseConfig(pin);
        window.showToast(`Connected to: ${res.name}`, 'success');
        updateModalStatus();
        window.renderHeader(window.currentUser);
        setTimeout(() => modal.classList.add('hidden'), 800);
      } catch (err) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-800 block';
        alertBox.textContent = err.message;
        window.showToast(err.message, 'error');
      } finally {
        fetchBtn.disabled = false;
        fetchBtnText.textContent = 'Fetch Config';
      }
    });
  }

  function updateModalStatus() {
    const statusText = document.getElementById('modal-status-text');
    const statusBadge = document.getElementById('modal-status-badge');
    const pinInput = document.getElementById('modal-pin');
    const savedPin = localStorage.getItem('SUPABASE_CONFIG_PIN');
    const savedName = localStorage.getItem('SUPABASE_CONFIG_NAME');

    if (savedPin || localStorage.getItem('SUPABASE_CONFIG_NAME')) {
      statusText.textContent = `${savedName || ('PIN: ' + savedPin)}`;
      statusBadge.textContent = 'Custom PIN Config';
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200';
      if (pinInput && savedPin) pinInput.value = savedPin;
    } else {
      statusText.textContent = 'Default Project Config';
      statusBadge.textContent = 'Default';
      statusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700';
      if (pinInput) pinInput.value = '';
    }
  }

  updateModalStatus();
  modal.classList.remove('hidden');
};


// Custom Toast notification system
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto px-4 sm:px-0';
    document.body.appendChild(container);
  }

  const toastId = 'toast-' + Math.random().toString(36).substring(2, 9);
  
  let borderBgClass = 'border-slate-200 bg-slate-50 text-slate-900';
  let iconHtml = '<i data-lucide="info" class="w-5 h-5 text-blue-600"></i>';
  if (type === 'success') {
    borderBgClass = 'border-emerald-100 bg-emerald-50 text-emerald-900';
    iconHtml = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-600"></i>';
  } else if (type === 'error') {
    borderBgClass = 'border-rose-100 bg-rose-50 text-rose-900';
    iconHtml = '<i data-lucide="alert-circle" class="w-5 h-5 text-rose-600"></i>';
  }

  const toastEl = document.createElement('div');
  toastEl.id = toastId;
  toastEl.className = `flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-slide-up bg-white ${borderBgClass}`;
  toastEl.innerHTML = `
    <span class="mt-0.5">${iconHtml}</span>
    <div class="flex-1 text-sm font-medium pr-2">${message}</div>
    <button onclick="document.getElementById('${toastId}').remove()" class="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-100">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(toastEl);
  if (window.lucide) {
    window.lucide.createIcons();
  }

  setTimeout(() => {
    const el = document.getElementById(toastId);
    if (el) el.remove();
  }, 4000);
};

// Check Auth State on DOMContentLoaded
window.checkAuth = async function(requiredRole = 'teacher') {
  const path = window.location.pathname;
  const isLoginPage = path.includes('login');
  const isTeacherPage = path.includes('dashboard') || 
                        path.includes('questions') || 
                        path.includes('create') || 
                        path.includes('reports');

  // Ensure supabase client is ready before checking auth
  if (typeof window.ensureSupabaseClient === 'function') {
    await window.ensureSupabaseClient();
  }

  if (!window.supabaseClient || !window.supabaseClient.auth) {
    window.currentUser = null;
    if (isTeacherPage) {
      window.location.href = 'login.html';
    }
    return null;
  }

  let user = null;
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    user = session ? session.user : null;
  } catch (err) {
    console.warn('Auth session check skipped/failed:', err);
  }
  window.currentUser = user;

  if (isTeacherPage) {
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }

    try {
      await window.ensureTeacherProfile(user);
    } catch (err) {
      console.error('Failed to ensure teacher profile:', err);
      window.showToast('Could not prepare your teacher account. Please sign in again.', 'error');
      return null;
    }
  }

  if (isLoginPage) {
    if (user) {
      try {
        await window.ensureTeacherProfile(user);
      } catch (err) {
        console.error('Failed to ensure teacher profile:', err);
      }
      window.location.href = 'dashboard.html';
      return null;
    }
  }

  return user;
};

window.ensureTeacherProfile = async function(user) {
  if (!user || !user.id) return;

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'Teacher');

  const { error } = await window.supabaseClient
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email || '',
      full_name: fullName,
    }, { onConflict: 'id' });

  if (error) throw error;
};

// ==========================================
// Student Authentication & Session Management
// ==========================================

window.getStudentSession = function() {
  try {
    const raw = sessionStorage.getItem('studentSession') || localStorage.getItem('studentSession');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.admission_number || parsed.admission_no)) {
      return parsed;
    }
  } catch (e) {
    console.warn('Error reading studentSession:', e);
  }
  return null;
};

window.setStudentSession = function(student) {
  if (!student) return null;
  const name = (student.name || student.student_name || student.full_name || 'Student').trim();
  const adm = String(student.admission_number || student.admission_no || '').trim();
  const phone = String(student.phone_number || student.phone || student.mobile || '').trim();

  const sessionObj = {
    id: student.id || null,
    name: name,
    student_name: name,
    admission_number: adm,
    admission_no: adm,
    phone_number: phone,
    grade_or_class: student.grade_or_class || student.class || ''
  };

  const str = JSON.stringify(sessionObj);
  try {
    sessionStorage.setItem('studentSession', str);
    localStorage.setItem('studentSession', str);
    sessionStorage.setItem('studentName', name);
    localStorage.setItem('studentName', name);
    sessionStorage.setItem('studentAdmissionNo', adm);
    localStorage.setItem('studentAdmissionNo', adm);
  } catch (e) {
    console.warn('Could not persist student session:', e);
  }
  return sessionObj;
};

window.clearStudentSession = function() {
  try {
    sessionStorage.removeItem('studentSession');
    localStorage.removeItem('studentSession');
    sessionStorage.removeItem('studentName');
    localStorage.removeItem('studentName');
    sessionStorage.removeItem('studentAdmissionNo');
    localStorage.removeItem('studentAdmissionNo');
  } catch (e) {}
};

window.normalizePhoneNumber = function(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, ''); // Extract numeric digits only
};

// Verify student credentials against Supabase (supports hostel_9_class_2026_27 and public.students tables)
window.verifyStudentCredentials = async function(admissionNumber, phoneNumber) {
  const cleanAdm = String(admissionNumber || '').trim();
  const cleanPhone = String(phoneNumber || '').trim();

  if (!cleanAdm) {
    return { success: false, error: 'Admission Number is required.' };
  }
  if (!cleanPhone) {
    return { success: false, error: 'Phone Number is required.' };
  }

  if (typeof window.ensureSupabaseClient === 'function') {
    await window.ensureSupabaseClient();
  }

  if (!window.supabaseClient) {
    return {
      success: false,
      error: 'Supabase client is not connected. Please verify your Supabase URL and Anon Key in config.js.'
    };
  }

  const normCleanPhone = window.normalizePhoneNumber(cleanPhone);
  // Candidate tables in Supabase: user's specific table hostel_9_class_2026_27 and standard students
  const candidateTables = ['hostel_9_class_2026_27', 'students'];
  let foundTableWithRLSIssue = false;
  let targetTableWithRLS = '';
  let foundTable = false;

  for (const tableName of candidateTables) {
    try {
      const { data, error } = await window.supabaseClient
        .from(tableName)
        .select('*');

      if (error) {
        // If table doesn't exist in Supabase schema cache, continue to next candidate table
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          (error.message && (error.message.includes('does not exist') || error.message.includes('schema cache')))
        ) {
          continue;
        }
        console.warn(`Error querying table '${tableName}':`, error);
        continue;
      }

      foundTable = true;
      const rows = data || [];

      // If the table exists in Supabase but returns 0 rows, check if RLS is enabled without an anon policy
      if (rows.length === 0) {
        foundTableWithRLSIssue = true;
        targetTableWithRLS = tableName;
        continue;
      }

      // Search rows in this table
      const matched = rows.find(row => {
        // Extract admission number from various column names (ADMIN, admission_number, admission_no, roll_no, etc.)
        const rowAdm = String(
          row.ADMIN ?? row.admin ?? row.admission_number ?? row.admission_no ?? row.roll_no ?? ''
        ).trim();

        if (rowAdm.toLowerCase() !== cleanAdm.toLowerCase()) {
          return false;
        }

        // Admission matched! Now verify phone number
        const rowPhone = String(
          row['PH-1'] ?? row['ph-1'] ?? row['PH_1'] ?? row.phone_number ?? row.phone ?? row.mobile ?? ''
        ).trim();
        const normRowPhone = window.normalizePhoneNumber(rowPhone);

        // 1. Exact string match
        if (rowPhone === cleanPhone) return true;

        // 2. Normalized numeric digits match
        if (normRowPhone && normCleanPhone) {
          if (normRowPhone === normCleanPhone) return true;
          // Match 10-digit suffix (ignores country code prefixes like +91 or 0)
          if (normRowPhone.length >= 10 && normCleanPhone.length >= 10) {
            return normRowPhone.slice(-10) === normCleanPhone.slice(-10);
          }
        }
        return false;
      });

      if (matched) {
        const studentName = String(
          matched['STUDENT NAME'] ?? matched['student_name'] ?? matched.name ?? matched.full_name ?? `Student ${cleanAdm}`
        ).trim();
        const studentAdm = String(
          matched.ADMIN ?? matched.admin ?? matched.admission_number ?? matched.admission_no ?? cleanAdm
        ).trim();
        const studentPhone = String(
          matched['PH-1'] ?? matched['ph-1'] ?? matched.phone_number ?? matched.phone ?? cleanPhone
        ).trim();
        const studentClass = String(
          matched.CLASS ?? matched.class ?? matched.grade_or_class ?? ''
        ).trim();

        return {
          success: true,
          student: {
            id: matched.SNO ?? matched.id ?? studentAdm,
            name: studentName,
            student_name: studentName,
            admission_number: studentAdm,
            phone_number: studentPhone,
            grade_or_class: studentClass
          }
        };
      }

      // Check if admission number was found but phone number was incorrect
      const admOnlyMatch = rows.find(row => {
        const rowAdm = String(
          row.ADMIN ?? row.admin ?? row.admission_number ?? row.admission_no ?? row.roll_no ?? ''
        ).trim();
        return rowAdm.toLowerCase() === cleanAdm.toLowerCase();
      });

      if (admOnlyMatch) {
        return {
          success: false,
          error: `Phone number does not match our records for Admission Number "${cleanAdm}". Please enter your registered phone number.`
        };
      }
    } catch (err) {
      console.warn(`Exception inspecting table ${tableName}:`, err);
    }
  }

  // If table exists but RLS is blocking anon select
  if (foundTableWithRLSIssue) {
    return {
      success: false,
      isRlsIssue: true,
      error: `Table '${targetTableWithRLS}' exists in Supabase, but Row Level Security (RLS) is blocking read access for student logins. Please click 'Add RLS policy' on '${targetTableWithRLS}' in your Supabase dashboard or run:\nALTER TABLE public.${targetTableWithRLS} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Allow students select" ON public.${targetTableWithRLS} FOR SELECT USING (true);`
    };
  }

  if (foundTable) {
    return {
      success: false,
      error: `No student record found with Admission Number "${cleanAdm}". Please check your details.`
    };
  }

  return {
    success: false,
    isSchemaMissing: true,
    error: "Neither 'hostel_9_class_2026_27' nor 'students' table could be accessed. Please check your Supabase project permissions or run the schema in 'supabase_schema.sql'."
  };
};

// Expose standard Header render logic
window.renderHeader = function(user) {
  window.currentUser = user;
  const student = (typeof window.getStudentSession === 'function') ? window.getStudentSession() : null;
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const userEmail = user ? user.email : '';
  const configName = localStorage.getItem('SUPABASE_CONFIG_NAME') || 'DB Config';

  let authSectionHtml = '';
  if (user) {
    // Teacher is authenticated
    authSectionHtml = `
      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-slate-600 hidden md:inline-block truncate max-w-[180px]">
          ${escapeHtml(userEmail)}
        </span>
        <a
          href="dashboard.html"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
        >
          <i data-lucide="layout-dashboard" class="w-4 h-4 text-slate-500"></i>
          Dashboard
        </a>
        <button
          id="logout-btn"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200 cursor-pointer"
        >
          <i data-lucide="log-out" class="w-4 h-4 text-slate-500"></i>
          Logout
        </button>
      </div>
    `;
  } else if (student) {
    // Student is authenticated
    authSectionHtml = `
      <div class="flex items-center gap-2 sm:gap-3">
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-100 text-xs font-semibold max-w-[200px] truncate" title="Admission: ${escapeHtml(student.admission_number)}">
          <i data-lucide="graduation-cap" class="w-4 h-4 text-blue-600 shrink-0"></i>
          <span class="truncate">${escapeHtml(student.name)}</span>
          <span class="text-blue-500 font-mono text-[11px]">(${escapeHtml(student.admission_number)})</span>
        </span>
        <a
          href="index.html"
          class="inline-flex items-center gap-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
        >
          <i data-lucide="play" class="w-3.5 h-3.5 text-blue-600"></i>
          Lobby
        </a>
        <button
          id="student-logout-btn"
          class="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200 cursor-pointer"
          title="Sign out of student account"
        >
          <i data-lucide="log-out" class="w-3.5 h-3.5 text-slate-500"></i>
          <span class="hidden sm:inline">Logout</span>
        </button>
      </div>
    `;
  } else {
    // Neither teacher nor student is signed in
    authSectionHtml = `
      <div class="flex items-center gap-2">
        <a
          href="login.html?role=student"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-blue-200 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200"
        >
          <i data-lucide="graduation-cap" class="w-4 h-4 text-blue-600"></i>
          Student Login
        </a>
        <a
          href="login.html?role=teacher"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
        >
          <i data-lucide="school" class="w-4 h-4 text-slate-500"></i>
          Teacher Login
        </a>
      </div>
    `;
  }

  headerContainer.innerHTML = `
    <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <a href="index.html" class="flex items-center gap-2">
              <span class="p-2 bg-blue-50 rounded-xl text-blue-600">
                <i data-lucide="book-open" class="w-6 h-6"></i>
              </span>
              <span class="text-xl font-bold text-blue-600 tracking-tight">
                Quiz Platform
              </span>
            </a>
          </div>

          <div class="flex items-center gap-3" id="header-auth-section">
            <button
              id="db-config-header-btn"
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200 cursor-pointer"
              title="Configure Database Connection PIN"
            >
              <i data-lucide="database" class="w-4 h-4 text-blue-600"></i>
              <span class="hidden sm:inline">${escapeHtml(configName)}</span>
            </button>

            ${authSectionHtml}
          </div>
        </div>
      </div>
    </header>
  `;

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Bind DB Config modal opener
  const dbConfigBtn = document.getElementById('db-config-header-btn');
  if (dbConfigBtn) {
    dbConfigBtn.addEventListener('click', () => {
      if (typeof window.openSupabaseConfigModal === 'function') {
        window.openSupabaseConfigModal();
      }
    });
  }

  // Bind teacher logout action
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (window.supabaseClient && window.supabaseClient.auth) {
        await window.supabaseClient.auth.signOut();
      }
      window.location.href = 'login.html?role=teacher';
    });
  }

  // Bind student logout action
  const studentLogoutBtn = document.getElementById('student-logout-btn');
  if (studentLogoutBtn) {
    studentLogoutBtn.addEventListener('click', () => {
      window.clearStudentSession();
      window.showToast('You have signed out.', 'info');
      setTimeout(() => {
        window.location.href = 'login.html?role=student';
      }, 500);
    });
  }
};
