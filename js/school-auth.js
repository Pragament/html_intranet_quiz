/**
 * CENTRALIZED SCHOOL MANAGEMENT ECOSYSTEM - UNIFIED AUTH & SESSION MANAGER
 * Project: smart-school-automation (Supabase Ref: blqnzrhiatvfydmswprb)
 * Supports:
 *   - Method A: Teacher-Generated Temporary PIN (Shared Computer Labs)
 *   - Method B: Individual Student Login (Admission Number + Password)
 *   - Student Account Activation & Password Change
 *   - Centralized Session Management (Tab/Browser Isolation for Shared PCs)
 *   - Teacher Dashboard Management (PIN generation, Student Directory, Password Reset)
 */

(function (window) {
  'use strict';

  const CONFIG = {
    supabaseUrl: 'https://blqnzrhiatvfydmswprb.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJscW56cmhpYXR2ZnlkbXN3cHJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NjM3ODYsImV4cCI6MjExMDIzOTc4Nn0.9PytkMfnlmr909cEy5-J3-3Gzuxh81rSKLvz0pnJQGU',
    sessionStorageKey: 'SCHOOL_STUDENT_SESSION',
    studentStorageKey: 'SCHOOL_STUDENT_DATA'
  };

  let supabaseClient = null;

  function initClient() {
    if (supabaseClient) return supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    } else if (window.supabaseJs && typeof window.supabaseJs.createClient === 'function') {
      supabaseClient = window.supabaseJs.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    }
    return supabaseClient;
  }

  function getStoredSessionToken() {
    return sessionStorage.getItem(CONFIG.sessionStorageKey) || localStorage.getItem(CONFIG.sessionStorageKey) || null;
  }

  function getStoredStudent() {
    const raw = sessionStorage.getItem(CONFIG.studentStorageKey) || localStorage.getItem(CONFIG.studentStorageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setSession(sessionToken, studentData, persist) {
    if (persist) {
      localStorage.setItem(CONFIG.sessionStorageKey, sessionToken);
      localStorage.setItem(CONFIG.studentStorageKey, JSON.stringify(studentData));
    }
    // Always keep in sessionStorage for lab PC tab isolation
    sessionStorage.setItem(CONFIG.sessionStorageKey, sessionToken);
    sessionStorage.setItem(CONFIG.studentStorageKey, JSON.stringify(studentData));
  }

  function clearSession() {
    sessionStorage.removeItem(CONFIG.sessionStorageKey);
    sessionStorage.removeItem(CONFIG.studentStorageKey);
    localStorage.removeItem(CONFIG.sessionStorageKey);
    localStorage.removeItem(CONFIG.studentStorageKey);
  }

  const SchoolAuth = {
    config: CONFIG,

    init: function () {
      return initClient();
    },

    getClient: function () {
      return initClient();
    },

    getToken: function () {
      return getStoredSessionToken();
    },

    getStudent: function () {
      return getStoredStudent();
    },

    isLoggedIn: function () {
      return !!getStoredSessionToken();
    },

    /**
     * Method A: Shared Computer Login with Teacher-Generated Temporary PIN
     */
    loginWithPin: async function (admissionNumber, phoneNumber, pin, appName) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('student_pin_login', {
        p_admission_number: admissionNumber,
        p_phone_number: phoneNumber,
        p_pin: pin,
        p_app_name: appName || 'portal',
        p_device_id: navigator.userAgent
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error((data && data.message) || 'PIN verification failed');

      setSession(data.session_token, data.student, false);
      window.dispatchEvent(new CustomEvent('school-auth-changed', { detail: { student: data.student } }));
      return data;
    },

    /**
     * Method B: Individual Student Login (Admission Number + Password)
     */
    loginWithPassword: async function (admissionNumber, password, appName, rememberMe) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('student_password_login', {
        p_admission_number: admissionNumber,
        p_password: password,
        p_app_name: appName || 'portal',
        p_device_id: navigator.userAgent
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) {
        const err = new Error((data && data.message) || 'Login failed');
        if (data && data.needs_activation) err.needs_activation = true;
        throw err;
      }

      setSession(data.session_token, data.student, !!rememberMe);
      window.dispatchEvent(new CustomEvent('school-auth-changed', { detail: { student: data.student } }));
      return data;
    },

    /**
     * Student Account Activation (Sets initial password)
     */
    activateAccount: async function (admissionNumber, phoneNumber, newPassword) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('student_activate_account', {
        p_admission_number: admissionNumber,
        p_phone_number: phoneNumber,
        p_new_password: newPassword
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error((data && data.message) || 'Activation failed');

      return data;
    },

    /**
     * Student Password Change
     */
    changePassword: async function (oldPassword, newPassword) {
      const client = initClient();
      const token = getStoredSessionToken();
      if (!client) throw new Error('Supabase client is not loaded');
      if (!token) throw new Error('No active student session');

      const { data, error } = await client.rpc('student_change_password', {
        p_session_token: token,
        p_old_password: oldPassword,
        p_new_password: newPassword
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error((data && data.message) || 'Failed to change password');

      return data;
    },

    /**
     * Verify Session Validity
     */
    verifySession: async function () {
      const client = initClient();
      const token = getStoredSessionToken();
      if (!client || !token) {
        clearSession();
        return { valid: false };
      }

      try {
        const { data, error } = await client.rpc('student_verify_session', {
          p_session_token: token
        });

        if (error || !data || !data.valid) {
          clearSession();
          return { valid: false };
        }

        // Refresh student data in storage
        if (data.student) {
          sessionStorage.setItem(CONFIG.studentStorageKey, JSON.stringify(data.student));
        }
        return data;
      } catch (e) {
        return { valid: false, error: e };
      }
    },

    /**
     * Student Self-service Data Fetch
     */
    getMyData: async function () {
      const client = initClient();
      const token = getStoredSessionToken();
      if (!client) throw new Error('Supabase client is not loaded');
      if (!token) throw new Error('Please log in first');

      const { data, error } = await client.rpc('student_get_my_data', {
        p_session_token: token
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error((data && data.message) || 'Failed to fetch student data');

      return data;
    },

    /**
     * Student Logout
     */
    logout: async function () {
      const client = initClient();
      const token = getStoredSessionToken();
      if (client && token) {
        try {
          await client.rpc('student_logout', { p_session_token: token });
        } catch (e) {
          console.warn('Logout RPC failed:', e);
        }
      }
      clearSession();
      window.dispatchEvent(new CustomEvent('school-auth-changed', { detail: { student: null } }));
    },

    // -------------------------------------------------------------
    // TEACHER DASHBOARD API METHODS
    // -------------------------------------------------------------
    teacherGeneratePin: async function (options) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');
      const opts = options || {};

      const { data, error } = await client.rpc('teacher_generate_pin', {
        p_class: opts.targetClass || null,
        p_section: opts.targetSection || null,
        p_duration_minutes: opts.durationMinutes || 60,
        p_max_uses: opts.maxUses || null,
        p_custom_pin: opts.customPin || null
      });

      if (error) throw new Error(error.message);
      if (!data || !data.success) throw new Error((data && data.message) || 'PIN generation failed');

      return data;
    },

    teacherGetActivePins: async function () {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('teacher_get_active_pins');
      if (error) throw new Error(error.message);
      return data && data.pins ? data.pins : [];
    },

    teacherRevokePin: async function (pinId) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('teacher_revoke_pin', { p_pin_id: pinId });
      if (error) throw new Error(error.message);
      return data;
    },

    teacherGetStudents: async function (search, classVal, sectionVal) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('teacher_get_students', {
        p_search: search || '',
        p_class: classVal || null,
        p_section: sectionVal || null
      });

      if (error) throw new Error(error.message);
      return data && data.students ? data.students : [];
    },

    teacherResetStudentPassword: async function (studentId, tempPassword) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('teacher_reset_student_password', {
        p_student_id: studentId,
        p_temp_password: tempPassword
      });

      if (error) throw new Error(error.message);
      return data;
    },

    teacherToggleStudentStatus: async function (studentId, status) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('teacher_toggle_student_status', {
        p_student_id: studentId,
        p_new_status: status
      });

      if (error) throw new Error(error.message);
      return data;
    },

    teacherGetStudentHistory: async function (studentId) {
      const client = initClient();
      if (!client) throw new Error('Supabase client is not loaded');

      const { data, error } = await client.rpc('teacher_get_student_history', {
        p_student_id: studentId
      });

      if (error) throw new Error(error.message);
      return data && data.history ? data.history : [];
    },

    // -------------------------------------------------------------
    // UI COMPONENTS: MODAL & HEADER BADGE
    // -------------------------------------------------------------
    showLoginModal: function (options) {
      const opts = options || {};
      const modalId = 'school-auth-modal';
      let existing = document.getElementById(modalId);
      if (existing) existing.remove();

      const modalEl = document.createElement('div');
      modalEl.id = modalId;
      modalEl.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <div style="background:#ffffff;border-radius:20px;max-width:440px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #e2e8f0;overflow:hidden;animation:schoolAuthFadeIn 0.2s ease-out;">
            <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:22px 24px;color:#ffffff;display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:20px;">🎓</div>
                <div>
                  <h3 style="margin:0;font-size:17px;font-weight:700;">Student Portal Login</h3>
                  <p style="margin:2px 0 0;font-size:12px;opacity:0.9;">Central School Management System</p>
                </div>
              </div>
              <button type="button" id="school-auth-close" style="background:none;border:none;color:#ffffff;font-size:22px;cursor:pointer;line-height:1;">&times;</button>
            </div>

            <!-- Tabs -->
            <div style="display:flex;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
              <button type="button" id="tab-btn-pin" style="flex:1;padding:12px 8px;font-size:13px;font-weight:700;color:#2563eb;background:#ffffff;border:none;border-bottom:2px solid #2563eb;cursor:pointer;">
                🏫 Shared Lab PIN
              </button>
              <button type="button" id="tab-btn-pwd" style="flex:1;padding:12px 8px;font-size:13px;font-weight:600;color:#64748b;background:none;border:none;cursor:pointer;">
                🔑 Student Password
              </button>
              <button type="button" id="tab-btn-act" style="flex:1;padding:12px 8px;font-size:13px;font-weight:600;color:#64748b;background:none;border:none;cursor:pointer;">
                ⚡ Activate
              </button>
            </div>

            <div style="padding:22px 24px;">
              <div id="school-auth-alert" style="display:none;padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:16px;"></div>

              <!-- Form 1: Shared Computer PIN Login -->
              <form id="school-form-pin" style="display:flex;flex-direction:column;gap:14px;">
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Admission Number</label>
                  <input type="text" id="pin-adm" placeholder="e.g. ADM101 or DSS001" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:600;text-transform:uppercase;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Registered Phone Number</label>
                  <input type="tel" id="pin-phone" placeholder="e.g. 9876543210" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Teacher Temporary PIN (6 digits)</label>
                  <input type="password" id="pin-code" maxlength="6" placeholder="Enter PIN from board (e.g. 654321)" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;letter-spacing:4px;font-weight:700;" />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">💡 Multiple students can use the teacher PIN; your session remains isolated.</span>
                </div>
                <button type="submit" id="btn-submit-pin" style="margin-top:6px;padding:12px;background:#2563eb;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s;">
                  Sign In with PIN
                </button>
              </form>

              <!-- Form 2: Individual Password Login -->
              <form id="school-form-pwd" style="display:none;flex-direction:column;gap:14px;">
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Admission Number</label>
                  <input type="text" id="pwd-adm" placeholder="e.g. ADM101 or DSS001" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:600;text-transform:uppercase;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Student Password</label>
                  <input type="password" id="pwd-pass" placeholder="Enter your password" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;" />
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <label style="font-size:12px;color:#475569;display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="pwd-remember" /> Remember on this personal device
                  </label>
                </div>
                <button type="submit" id="btn-submit-pwd" style="margin-top:6px;padding:12px;background:#2563eb;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s;">
                  Sign In with Password
                </button>
              </form>

              <!-- Form 3: Account Activation -->
              <form id="school-form-act" style="display:none;flex-direction:column;gap:14px;">
                <p style="font-size:12.5px;color:#475569;margin:0 0 6px;">Activate your student account and establish your personal login password.</p>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Admission Number</label>
                  <input type="text" id="act-adm" placeholder="e.g. ADM101 or DSS001" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:600;text-transform:uppercase;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Registered Phone Number</label>
                  <input type="tel" id="act-phone" placeholder="e.g. 9876543210" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;" />
                </div>
                <div>
                  <label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px;">Create Password (min 6 characters)</label>
                  <input type="password" id="act-pass" minlength="6" placeholder="Choose a secure password" required style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;" />
                </div>
                <button type="submit" id="btn-submit-act" style="margin-top:6px;padding:12px;background:#059669;color:#ffffff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;transition:background 0.2s;">
                  Activate Account
                </button>
              </form>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);

      const alertBox = modalEl.querySelector('#school-auth-alert');
      function showAlert(msg, isSuccess) {
        alertBox.style.display = 'block';
        alertBox.textContent = msg;
        if (isSuccess) {
          alertBox.style.background = '#ecfdf5';
          alertBox.style.color = '#065f46';
          alertBox.style.border = '1px solid #a7f3d0';
        } else {
          alertBox.style.background = '#fef2f2';
          alertBox.style.color = '#991b1b';
          alertBox.style.border = '1px solid #fecaca';
        }
      }

      // Tab switcher
      const tabPin = modalEl.querySelector('#tab-btn-pin');
      const tabPwd = modalEl.querySelector('#tab-btn-pwd');
      const tabAct = modalEl.querySelector('#tab-btn-act');
      const formPin = modalEl.querySelector('#school-form-pin');
      const formPwd = modalEl.querySelector('#school-form-pwd');
      const formAct = modalEl.querySelector('#school-form-act');

      function switchTab(activeTab) {
        alertBox.style.display = 'none';
        [tabPin, tabPwd, tabAct].forEach(t => {
          t.style.fontWeight = '600';
          t.style.color = '#64748b';
          t.style.background = 'none';
          t.style.borderBottom = 'none';
        });
        [formPin, formPwd, formAct].forEach(f => f.style.display = 'none');

        if (activeTab === 'pin') {
          tabPin.style.fontWeight = '700';
          tabPin.style.color = '#2563eb';
          tabPin.style.background = '#ffffff';
          tabPin.style.borderBottom = '2px solid #2563eb';
          formPin.style.display = 'flex';
        } else if (activeTab === 'pwd') {
          tabPwd.style.fontWeight = '700';
          tabPwd.style.color = '#2563eb';
          tabPwd.style.background = '#ffffff';
          tabPwd.style.borderBottom = '2px solid #2563eb';
          formPwd.style.display = 'flex';
        } else if (activeTab === 'act') {
          tabAct.style.fontWeight = '700';
          tabAct.style.color = '#059669';
          tabAct.style.background = '#ffffff';
          tabAct.style.borderBottom = '2px solid #059669';
          formAct.style.display = 'flex';
        }
      }

      tabPin.onclick = () => switchTab('pin');
      tabPwd.onclick = () => switchTab('pwd');
      tabAct.onclick = () => switchTab('act');
      modalEl.querySelector('#school-auth-close').onclick = () => modalEl.remove();

      // Submit PIN Login
      formPin.onsubmit = async (e) => {
        e.preventDefault();
        const btn = formPin.querySelector('#btn-submit-pin');
        btn.disabled = true;
        btn.textContent = 'Verifying PIN...';
        try {
          const adm = formPin.querySelector('#pin-adm').value.trim();
          const phone = formPin.querySelector('#pin-phone').value.trim();
          const pin = formPin.querySelector('#pin-code').value.trim();
          await SchoolAuth.loginWithPin(adm, phone, pin, opts.appName || 'portal');
          showAlert('Login successful! Redirecting...', true);
          setTimeout(() => {
            modalEl.remove();
            if (typeof opts.onSuccess === 'function') opts.onSuccess(SchoolAuth.getStudent());
            else window.location.reload();
          }, 600);
        } catch (err) {
          showAlert(err.message, false);
          btn.disabled = false;
          btn.textContent = 'Sign In with PIN';
        }
      };

      // Submit Password Login
      formPwd.onsubmit = async (e) => {
        e.preventDefault();
        const btn = formPwd.querySelector('#btn-submit-pwd');
        btn.disabled = true;
        btn.textContent = 'Authenticating...';
        try {
          const adm = formPwd.querySelector('#pwd-adm').value.trim();
          const pass = formPwd.querySelector('#pwd-pass').value;
          const remember = formPwd.querySelector('#pwd-remember').checked;
          await SchoolAuth.loginWithPassword(adm, pass, opts.appName || 'portal', remember);
          showAlert('Login successful! Redirecting...', true);
          setTimeout(() => {
            modalEl.remove();
            if (typeof opts.onSuccess === 'function') opts.onSuccess(SchoolAuth.getStudent());
            else window.location.reload();
          }, 600);
        } catch (err) {
          showAlert(err.message, false);
          if (err.needs_activation) {
            setTimeout(() => {
              switchTab('act');
              formAct.querySelector('#act-adm').value = formPwd.querySelector('#pwd-adm').value;
            }, 1200);
          }
          btn.disabled = false;
          btn.textContent = 'Sign In with Password';
        }
      };

      // Submit Activation
      formAct.onsubmit = async (e) => {
        e.preventDefault();
        const btn = formAct.querySelector('#btn-submit-act');
        btn.disabled = true;
        btn.textContent = 'Activating...';
        try {
          const adm = formAct.querySelector('#act-adm').value.trim();
          const phone = formAct.querySelector('#act-phone').value.trim();
          const pass = formAct.querySelector('#act-pass').value;
          const res = await SchoolAuth.activateAccount(adm, phone, pass);
          showAlert(res.message || 'Account activated!', true);
          setTimeout(() => {
            switchTab('pwd');
            formPwd.querySelector('#pwd-adm').value = adm;
            formPwd.querySelector('#pwd-pass').value = pass;
          }, 1500);
        } catch (err) {
          showAlert(err.message, false);
          btn.disabled = false;
          btn.textContent = 'Activate Account';
        }
      };
    },

    /**
     * Render header identity pill/badge into any container
     */
    renderHeaderBadge: function (containerId, options) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const opts = options || {};
      const student = SchoolAuth.getStudent();

      if (student) {
        container.innerHTML = `
          <div style="display:inline-flex;align-items:center;gap:10px;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px 12px;border-radius:24px;font-size:12.5px;">
            <div style="width:26px;height:26px;border-radius:50%;background:#2563eb;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">
              ${(student.full_name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <span style="font-weight:700;color:#0f172a;">${escapeHtml(student.full_name)}</span>
              <span style="color:#64748b;font-size:11px;margin-left:4px;">(${escapeHtml(student.admission_number)} &bull; ${escapeHtml(student.class)}-${escapeHtml(student.section)})</span>
            </div>
            <button type="button" id="school-auth-badge-logout" title="Sign out" style="background:none;border:none;color:#ef4444;font-weight:700;cursor:pointer;padding:2px 6px;margin-left:2px;font-size:11.5px;border-radius:6px;transition:background 0.15s;">
              Logout
            </button>
          </div>
        `;

        const logoutBtn = container.querySelector('#school-auth-badge-logout');
        if (logoutBtn) {
          logoutBtn.onclick = async () => {
            if (confirm('Are you sure you want to log out?')) {
              await SchoolAuth.logout();
              if (typeof opts.onLogout === 'function') opts.onLogout();
              else window.location.reload();
            }
          };
        }
      } else {
        container.innerHTML = `
          <button type="button" id="school-auth-badge-login" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#2563eb;color:#ffffff;border:none;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(37,99,235,0.25);">
            <span>🎓 Student Sign In</span>
          </button>
        `;
        const loginBtn = container.querySelector('#school-auth-badge-login');
        if (loginBtn) {
          loginBtn.onclick = () => SchoolAuth.showLoginModal(opts);
        }
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Initialize client when script loads
  initClient();

  window.SchoolAuth = SchoolAuth;
})(window);
