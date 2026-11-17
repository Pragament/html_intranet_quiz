// js/login.js

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
  }, 50);
});

document.addEventListener('DOMContentLoaded', async () => {
  // Check if teacher is already logged in (redirects to dashboard if so)
  const teacherUser = await window.checkAuth();
  window.renderHeader(teacherUser);

  let activeRole = 'student'; // 'student' or 'teacher'
  let isSignUp = false;

  // DOM Elements - Switcher & Header
  const roleTabStudent = document.getElementById('role-tab-student');
  const roleTabTeacher = document.getElementById('role-tab-teacher');
  const authTitle = document.getElementById('auth-title');
  const authSubtitleStudent = document.getElementById('auth-subtitle-student');
  const authSubtitleTeacher = document.getElementById('auth-subtitle-teacher');
  const authIconBadge = document.getElementById('auth-icon-badge');
  const authMainIcon = document.getElementById('auth-main-icon');
  const alertBox = document.getElementById('alert-box');

  // DOM Elements - Student Form
  const studentForm = document.getElementById('student-login-form');
  const admissionInput = document.getElementById('admission-number');
  const phoneInput = document.getElementById('phone-number');
  const studentSubmitBtn = document.getElementById('student-submit-btn');
  const studentBtnText = document.getElementById('student-btn-text');

  // DOM Elements - Teacher Form
  const authForm = document.getElementById('auth-form');
  const fullnameGroup = document.getElementById('fullname-group');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
  const googleAuthSection = document.getElementById('google-auth-section');
  const googleLoginBtn = document.getElementById('google-login-btn');

  // Check URL params for role or error
  const urlParams = new URLSearchParams(window.location.search);
  const requestedRole = urlParams.get('role');
  const errorParam = urlParams.get('error');

  if (requestedRole === 'teacher') {
    activeRole = 'teacher';
  } else {
    activeRole = 'student';
  }

  if (errorParam) {
    showAlert('error', decodeURIComponent(errorParam));
  }

  // Check if student is already logged in
  const existingStudent = typeof window.getStudentSession === 'function' ? window.getStudentSession() : null;
  if (existingStudent && activeRole === 'student' && !errorParam) {
    showAlert('success', `Currently signed in as ${existingStudent.name} (${existingStudent.admission_number}). You can enter a new admission number below to switch accounts, or proceed to the quiz lobby.`);
    if (admissionInput) admissionInput.value = existingStudent.admission_number || '';
    if (phoneInput) phoneInput.value = existingStudent.phone_number || '';
  }

  // Switch Role Handler
  function setRole(role) {
    activeRole = role;
    clearAlert();

    if (role === 'student') {
      // Tab Styles
      roleTabStudent.className = 'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-blue-600 text-white shadow-sm cursor-pointer';
      roleTabTeacher.className = 'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer';

      // Header info
      authTitle.textContent = 'Student Login';
      authSubtitleStudent.classList.remove('hidden');
      authSubtitleTeacher.classList.add('hidden');
      authIconBadge.className = 'inline-flex items-center justify-center p-3.5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-200 transition-colors';
      authMainIcon.setAttribute('data-lucide', 'graduation-cap');

      // Form visibility
      studentForm.classList.remove('hidden');
      authForm.classList.add('hidden');
      googleAuthSection.classList.add('hidden');
    } else {
      // Tab Styles
      roleTabTeacher.className = 'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-blue-600 text-white shadow-sm cursor-pointer';
      roleTabStudent.className = 'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 cursor-pointer';

      // Header info
      authTitle.textContent = isSignUp ? 'Create your teacher account' : 'Sign in as a Teacher';
      authSubtitleStudent.classList.add('hidden');
      authSubtitleTeacher.classList.remove('hidden');
      authIconBadge.className = 'inline-flex items-center justify-center p-3.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200 transition-colors';
      authMainIcon.setAttribute('data-lucide', 'school');

      // Form visibility
      studentForm.classList.add('hidden');
      authForm.classList.remove('hidden');
      googleAuthSection.classList.remove('hidden');
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Bind Role tab clicks
  if (roleTabStudent) {
    roleTabStudent.addEventListener('click', () => setRole('student'));
  }
  if (roleTabTeacher) {
    roleTabTeacher.addEventListener('click', () => setRole('teacher'));
  }

  // Initialize selected role
  setRole(activeRole);

  // Auto-uppercase Admission number input
  if (admissionInput) {
    admissionInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }

  // Show Alert box helper
  function showAlert(type, text) {
    alertBox.textContent = text;
    alertBox.className = 'mb-6 p-4 rounded-xl text-sm font-medium block animate-slide-up ';
    if (type === 'success') {
      alertBox.className += 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    } else if (type === 'info') {
      alertBox.className += 'bg-blue-50 text-blue-800 border border-blue-200';
    } else {
      alertBox.className += 'bg-rose-50 text-rose-800 border border-rose-200';
    }
  }

  function clearAlert() {
    alertBox.className = 'hidden mb-6 p-4 rounded-xl text-sm font-medium';
    alertBox.textContent = '';
  }

  // ==========================================
  // Student Login Form Submission
  // ==========================================
  if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert();

      const admissionNo = (admissionInput ? admissionInput.value : '').trim();
      const phoneNo = (phoneInput ? phoneInput.value : '').trim();

      if (!admissionNo) {
        showAlert('error', 'Please enter your Admission Number.');
        if (admissionInput) admissionInput.focus();
        return;
      }

      if (!phoneNo) {
        showAlert('error', 'Please enter your registered Phone Number.');
        if (phoneInput) phoneInput.focus();
        return;
      }

      studentSubmitBtn.disabled = true;
      studentBtnText.textContent = 'Verifying with database...';

      try {
        const result = await window.verifyStudentCredentials(admissionNo, phoneNo);

        if (result.success && result.student) {
          // Persist student session
          window.setStudentSession(result.student);
          window.renderHeader(null);

          showAlert('success', `Verification successful! Welcome, ${result.student.name}. Redirecting to Quiz Lobby...`);

          // Redirect to quiz lobby
          setTimeout(() => {
            const redirectParam = urlParams.get('redirect');
            if (redirectParam) {
              window.location.href = decodeURIComponent(redirectParam);
            } else {
              window.location.href = 'index.html';
            }
          }, 800);
        } else {
          // Details do not match
          const msg = result.error || 'Details do not match our database records. Please check your Admission Number and Phone Number.';
          showAlert('error', msg);
          studentSubmitBtn.disabled = false;
          studentBtnText.textContent = 'Sign in as Student';
        }
      } catch (err) {
        console.error('Student login error:', err);
        showAlert('error', err.message || 'An unexpected error occurred while verifying details.');
        studentSubmitBtn.disabled = false;
        studentBtnText.textContent = 'Sign in as Student';
      }
    });
  }

  // ==========================================
  // Teacher Authentication Flow
  // ==========================================
  toggleAuthModeBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    clearAlert();

    if (isSignUp) {
      authTitle.textContent = 'Create your teacher account';
      toggleAuthModeBtn.textContent = 'sign in to your existing account';
      fullnameGroup.classList.remove('hidden');
      document.getElementById('fullname').required = true;
      authSubmitBtn.textContent = 'Sign up';
    } else {
      authTitle.textContent = 'Sign in as a Teacher';
      toggleAuthModeBtn.textContent = 'register for a new account';
      fullnameGroup.classList.add('hidden');
      document.getElementById('fullname').required = false;
      authSubmitBtn.textContent = 'Sign in';
    }
  });

  // Handle Teacher Form Submission
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const fullName = document.getElementById('fullname').value.trim() || email.split('@')[0];

    if (!email || !password) {
      showAlert('error', 'Email and password are required');
      return;
    }

    authSubmitBtn.disabled = true;
    const originalText = authSubmitBtn.textContent;
    authSubmitBtn.textContent = 'Processing...';

    try {
      if (isSignUp) {
        // Teacher Sign Up Flow
        const { data, error } = await window.supabaseClient.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        const user = data.user;
        if (user) {
          const { error: profileError } = await window.supabaseClient
            .from('profiles')
            .upsert({
              id: user.id,
              email: email,
              full_name: fullName,
            });

          if (profileError) {
            console.error('Failed to create profile:', profileError.message);
          }
        }

        // Attempt sign in directly
        const { error: signInError } = await window.supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          showAlert('success', 'Sign up successful! Please check your email for confirmation.');
          isSignUp = false;
          fullnameGroup.classList.add('hidden');
          document.getElementById('fullname').required = false;
          authSubmitBtn.textContent = 'Sign in';
          authTitle.textContent = 'Sign in as a Teacher';
          toggleAuthModeBtn.textContent = 'register for a new account';
          document.getElementById('password').value = '';
        } else {
          showAlert('success', 'Sign up successful! Redirecting to dashboard...');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 800);
        }
      } else {
        // Teacher Sign In Flow
        const { error } = await window.supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        showAlert('success', 'Logging you in...');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 800);
      }
    } catch (err) {
      console.error('Teacher Auth error:', err);
      showAlert('error', err.message || 'An unexpected error occurred');
      authSubmitBtn.disabled = false;
      authSubmitBtn.textContent = originalText;
    }
  });

  // Handle Google Login
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      clearAlert();
      googleLoginBtn.disabled = true;
      try {
        const redirectUrl = new URL('dashboard.html', window.location.href).href;
        const { error } = await window.supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) throw error;
      } catch (err) {
        console.error('Google OAuth initialization failed:', err);
        showAlert('error', err.message || 'Failed to initialize Google login');
        googleLoginBtn.disabled = false;
      }
    });
  }
});

