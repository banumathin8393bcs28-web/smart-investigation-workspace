/**
 * Smart Investigation Workspace - Core Client Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Live Running Clock
  initLiveClock();

  // 2. Show/Hide Password Controls
  initPasswordToggles();

  // 3. DOB to Age Auto-Calculation
  initDobAgeCalculator();

  // 4. File Preview Before Upload
  initFilePreviews();

  // 5. Browser BeforeUnload Warning
  initBeforeUnloadWarning();

  // 6. Copy to Clipboard Utility
  initCopyHashButtons();

  // 7. Socket.IO Real-time Notifications & Chat
  initSocketIO();
});

function initLiveClock() {
  const clockElement = document.getElementById('liveClock');
  if (!clockElement) return;

  function updateClock() {
    const now = new Date();
    const options = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    try {
      clockElement.textContent = new Intl.DateTimeFormat('en-IN', options).format(now) + ' IST';
    } catch (e) {
      clockElement.textContent = now.toLocaleTimeString();
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
}

function initPasswordToggles() {
  const toggleButtons = document.querySelectorAll('.toggle-password-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<i class="bi bi-eye-slash"></i> Hide';
      } else {
        input.type = 'password';
        btn.innerHTML = '<i class="bi bi-eye"></i> Show';
      }
    });
  });
}

function initDobAgeCalculator() {
  const dobInput = document.getElementById('dobInput');
  const ageInput = document.getElementById('ageInput');
  if (!dobInput || !ageInput) return;

  dobInput.addEventListener('change', () => {
    const dobValue = dobInput.value;
    if (!dobValue) return;

    const birthDate = new Date(dobValue);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (!isNaN(age) && age >= 0) {
      ageInput.value = age;
    }
  });
}

function initFilePreviews() {
  const fileInputs = document.querySelectorAll('.image-preview-input');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const previewId = input.getAttribute('data-preview');
      const previewImg = document.getElementById(previewId);
      if (!previewImg || !input.files || !input.files[0]) return;

      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (re) => {
        previewImg.src = re.target.result;
        previewImg.classList.remove('d-none');
      };
      reader.readAsDataURL(file);
    });
  });
}

function initBeforeUnloadWarning() {
  // Only register for logged-in sessions (when data-auth-session is present on body)
  const isAuth = document.body.getAttribute('data-auth-session') === 'true';
  if (!isAuth) return;

  window.addEventListener('beforeunload', (e) => {
    // Standard browser beforeunload prompt
    const message = 'You have an active authorized investigation session. Please ensure you sign out properly before leaving.';
    e.preventDefault();
    e.returnValue = message;
    return message;
  });
}

function initCopyHashButtons() {
  const copyButtons = document.querySelectorAll('.btn-copy-hash');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hashText = btn.getAttribute('data-hash');
      if (!hashText) return;

      navigator.clipboard.writeText(hashText).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check"></i> Copied!';
        btn.classList.add('btn-success');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('btn-success');
        }, 2000);
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });
  });
}

function initSocketIO() {
  if (typeof io === 'undefined') return;

  const currentUserId = document.body.getAttribute('data-user-id');
  if (!currentUserId) return;

  const socket = io();

  // Join personal investigator notification room
  socket.emit('join_room', { room: `user_${currentUserId}` });

  // Listen for real-time notifications
  socket.on('new_notification', (data) => {
    // Update badge count
    const badge = document.getElementById('topbarNotificationBadge');
    if (badge) {
      let count = parseInt(badge.textContent || '0', 10);
      badge.textContent = count + 1;
      badge.classList.remove('d-none');
    }

    // Optional toast or alert notification
    const notificationContainer = document.getElementById('liveNotificationToastContainer');
    if (notificationContainer) {
      const toastEl = document.createElement('div');
      toastEl.className = 'alert alert-info alert-dismissible fade show shadow-sm mb-2';
      toastEl.innerHTML = `
        <strong>${data.title}</strong>: ${data.text}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      notificationContainer.appendChild(toastEl);
      setTimeout(() => toastEl.remove(), 6000);
    }
  });
}

// Global CAPTCHA Refresh Helper
function refreshCaptcha(imgId = 'captchaImage') {
  const img = document.getElementById(imgId);
  if (img) {
    img.src = '/auth/captcha?t=' + Date.now();
  }
}
