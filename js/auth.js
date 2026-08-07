// js/auth.js
// Initialize Supabase Client
if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  console.warn("Supabase config (config.js) is missing or not loaded!");
  window.supabaseClient = null;
} else if (window.supabase && typeof window.supabase.createClient === 'function') {
  window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
}

// Supabase Config Fetch & Management Logic
window.fetchSupabaseConfig = async function(pin, serverUrl = 'http://localhost:3000') {
  if (!pin || !pin.trim()) {
    throw new Error("PIN is required");
  }

  const cleanPin = pin.trim();
  const cleanHost = (serverUrl || 'http://localhost:3000').trim().replace(/\/$/, '');
  const endpoint = `${cleanHost}/api/config/get`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  let response;
  let result;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uuid: '',
        pin: cleanPin
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    result = await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out while fetching configuration from server.');
    }
    throw new Error('Failed to connect to configuration server. Please check your network.');
  }

  if (!response.ok || !result.success || result.error) {
    const errorMsg = result.error || 'Failed to fetch Supabase configuration';
    const err = new Error(errorMsg);
    err.requiresPin = !!result.requiresPin;
    throw err;
  }

  const url = result.config?.url || result.config?.projectUrl || result.config?.supabaseUrl || result.config?.project_url;
  const anonKey = result.config?.anonKey || result.config?.apiKey || result.config?.supabaseAnonKey || result.config?.anon_key;

  if (!result.config || !url || !anonKey) {
    throw new Error('Invalid configuration structure received from server.');
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
    window.supabaseClient = supabase.createClient(url, anonKey);
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

  window.SUPABASE_URL = window.DEFAULT_SUPABASE_URL || "";
  window.SUPABASE_ANON_KEY = window.DEFAULT_SUPABASE_ANON_KEY || "";
  if (window.supabase && typeof window.supabase.createClient === 'function' && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    window.supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } else {
    window.supabaseClient = null;
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
  if (!window.supabaseClient) {
    console.warn('Supabase client is not initialized. Redirecting to config PIN setup...');
    const path = window.location.pathname;
    if (!path.includes('config.html')) {
      window.location.href = 'config.html';
    }
    return null;
  }

  try {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error) {
      console.error('Session retrieval error:', error);
      const path = window.location.pathname;
      if (!path.includes('login.html') && !path.includes('config.html') && !path.includes('index.html') && !path.includes('quiz.html') && !path.includes('result.html')) {
        window.location.href = 'login.html';
      }
      return null;
    }

    const session = data ? data.session : null;
    const user = session ? session.user : null;
    window.currentUser = user;
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isTeacherPage = path.includes('dashboard.html') || 
                          path.includes('questions.html') || 
                          path.includes('create.html') || 
                          path.includes('reports.html');

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
  } catch (err) {
    console.error('Error during checkAuth:', err);
    return null;
  }
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

// Expose standard Header render logic
window.renderHeader = function(user) {
  window.currentUser = user;
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  const userEmail = user ? user.email : '';
  const isCustomConfig = !!localStorage.getItem('SUPABASE_CONFIG_UUID');
  const configName = localStorage.getItem('SUPABASE_CONFIG_NAME') || 'Config';

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
            ${user ? `
              <div class="flex items-center gap-3">
                <span class="text-sm font-medium text-slate-600 hidden md:inline-block truncate max-w-[180px]">
                  ${userEmail}
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
            ` : `
              <a
                href="login.html"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
              >
                <i data-lucide="log-in" class="w-4 h-4 text-slate-500"></i>
                Teacher Login
              </a>
            `}
          </div>
        </div>
      </div>
    </header>
  `;

  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Bind logout action
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });
  }
};

