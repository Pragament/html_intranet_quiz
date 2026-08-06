// js/config-page.js

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  const pinForm = document.getElementById('pin-form');
  const pinInput = document.getElementById('intranet-pin-input') || document.getElementById('school-pin-input');
  const continueBtn = document.getElementById('continue-btn');
  const btnText = document.getElementById('btn-text');
  const alertBox = document.getElementById('alert-box');
  const resetTopBtn = document.getElementById('reset-config-top-btn');

  // Ensure input field starts empty for user entry
  if (pinInput) {
    pinInput.value = '';
  }

  const skipLink = document.getElementById('skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', () => {
      sessionStorage.setItem('config_verified', 'true');
      localStorage.setItem('SUPABASE_CONFIG_PIN', 'default');
    });
  }

  resetTopBtn.addEventListener('click', () => {
    window.resetSupabaseConfig();
    sessionStorage.removeItem('config_verified');
    if (pinInput) pinInput.value = '';
    window.showToast('Reset to default Supabase configuration.', 'info');
    alertBox.classList.add('hidden');
  });

  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinInput ? pinInput.value.trim() : '';

    if (!pin) {
      showAlert('error', 'Please enter your Intranet Quiz PIN.');
      return;
    }

    alertBox.classList.add('hidden');
    continueBtn.disabled = true;
    btnText.textContent = 'Connecting...';

    try {
      const res = await window.fetchSupabaseConfig(pin);
      sessionStorage.setItem('config_verified', 'true');
      window.showToast(`Connected to: ${res.name}`, 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } catch (err) {
      showAlert('error', err.message || 'Failed to fetch configuration for this PIN.');
      continueBtn.disabled = false;
      btnText.textContent = 'Continue';
    }
  });

  function showAlert(type, msg) {
    alertBox.textContent = msg;
    alertBox.className = 'p-3.5 rounded-xl text-xs font-medium block ';
    if (type === 'success') {
      alertBox.className += 'bg-emerald-50 text-emerald-800 border border-emerald-200';
    } else {
      alertBox.className += 'bg-rose-50 text-rose-800 border border-rose-200';
    }
  }
});
