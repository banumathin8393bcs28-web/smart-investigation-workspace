/**
 * Smart Investigation Workspace - Core Client Scripts
 * Responsive UI Enhancements, Cryptographic Copying, Live Clock & Sockets
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Sidebar Navigation Toggle
  initMobileSidebarToggle();

  // 2. Live Running Clock (Asia/Kolkata IST)
  initLiveClock();

  // 3. Show/Hide Password Controls
  initPasswordToggles();

  // 4. DOB to Age Auto-Calculation
  initDobAgeCalculator();

  // 5. File Preview Before Upload
  initFilePreviews();

  // 6. Browser BeforeUnload Warning for Authenticated Sessions
  initBeforeUnloadWarning();

  // 7. Copy to Clipboard Utility for SHA-256 Hashes
  initCopyHashButtons();

  // 8. Socket.IO Real-time Notifications & Chat
  initSocketIO();

  // 9. Auto-Dismiss Flash Alerts after 8 seconds
  initAutoDismissAlerts();
});

/**
 * Mobile Sidebar Navigation Toggle
 */
function initMobileSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebar = document.querySelector('.gov-sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  if (!toggleBtn || !sidebar) return;

  function toggleSidebar() {
    sidebar.classList.toggle('show');
    if (backdrop) backdrop.classList.toggle('show');
  }

  function closeSidebar() {
    sidebar.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Close sidebar on link click on small screens
  sidebar.querySelectorAll('.gov-sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 992) {
        closeSidebar();
      }
    });
  });
}

/**
 * Live Clock (Asia/Kolkata IST)
 */
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

/**
 * Show / Hide Password Controls
 */
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

/**
 * DOB to Age Auto-Calculation
 */
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

/**
 * Image Previews Before Upload
 */
function initFilePreviews() {
  const fileInputs = document.querySelectorAll('.image-preview-input');
  fileInputs.forEach(input => {
    input.addEventListener('change', () => {
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

  // Multiple evidence files upload table generator
  const evidenceFilesInput = document.getElementById('evidenceFiles');
  const fileListContainer = document.getElementById('fileListContainer');
  const fileCountEl = document.getElementById('fileCount');
  const previewTableBody = document.getElementById('previewTableBody');

  if (evidenceFilesInput && fileListContainer && previewTableBody) {
    evidenceFilesInput.addEventListener('change', () => {
      const files = Array.from(evidenceFilesInput.files || []);
      if (files.length === 0) {
        fileListContainer.classList.add('d-none');
        return;
      }

      if (fileCountEl) fileCountEl.textContent = files.length;
      previewTableBody.innerHTML = '';

      files.forEach((file, index) => {
        const tr = document.createElement('tr');
        const sizeKb = (file.size / 1024).toFixed(1);
        tr.innerHTML = `
          <td class="small fw-semibold text-dark">${index + 1}</td>
          <td class="small text-truncate" style="max-width: 220px;" title="${file.name}">
            <i class="bi bi-file-earmark-image me-1 text-primary"></i> ${file.name}
          </td>
          <td class="small text-muted">${sizeKb} KB</td>
          <td>
            <input type="text" name="descriptions[]" class="form-control form-control-sm" placeholder="Evidence description / orientation note...">
          </td>
        `;
        previewTableBody.appendChild(tr);
      });

      fileListContainer.classList.remove('d-none');
    });
  }
}

/**
 * Browser BeforeUnload Warning for Authenticated Sessions
 */
function initBeforeUnloadWarning() {
  const isAuth = document.body.getAttribute('data-auth-session') === 'true';
  if (!isAuth) return;

  // Track if user is submitting a form so we don't warn during legitimate submits
  let isSubmitting = false;
  document.querySelectorAll('form').forEach(f => {
    f.addEventListener('submit', () => {
      isSubmitting = true;
    });
  });

  window.addEventListener('beforeunload', (e) => {
    if (isSubmitting) return;
    // Standard browser beforeunload prompt
    const message = 'You have an active authorized investigation session. Please ensure you sign out properly before leaving.';
    e.preventDefault();
    e.returnValue = message;
    return message;
  });
}

/**
 * Copy to Clipboard Utility for SHA-256 Hashes
 */
function initCopyHashButtons() {
  const copyButtons = document.querySelectorAll('.btn-copy-hash');
  copyButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const hashText = btn.getAttribute('data-hash');
      if (!hashText) return;

      navigator.clipboard.writeText(hashText).then(() => {
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check2"></i> Copied';
        btn.classList.add('btn-success');
        btn.classList.remove('btn-gov-secondary', 'btn-outline-secondary');
        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.classList.remove('btn-success');
          btn.classList.add('btn-gov-secondary');
        }, 2000);
      }).catch(err => {
        console.error('Copy hash failed:', err);
      });
    });
  });
}

/**
 * Socket.IO Real-time Notifications & Chat
 */
function initSocketIO() {
  if (typeof io === 'undefined') return;

  const currentUserId = document.body.getAttribute('data-user-id');
  if (!currentUserId) return;

  const socket = io();

  // Join personal investigator notification room
  socket.emit('join_room', { room: `user_${currentUserId}` });

  // Listen for real-time notifications
  socket.on('new_notification', (data) => {
    const badge = document.getElementById('topbarNotificationBadge');
    if (badge) {
      let count = parseInt(badge.textContent || '0', 10);
      badge.textContent = count + 1;
      badge.classList.remove('d-none');
    }

    const notificationContainer = document.getElementById('liveNotificationToastContainer');
    if (notificationContainer) {
      const toastEl = document.createElement('div');
      toastEl.className = 'alert alert-info alert-gov alert-dismissible fade show shadow-sm mb-2';
      toastEl.innerHTML = `
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-bell-fill text-primary mt-1"></i>
          <div>
            <strong>${data.title}</strong>
            <div class="small">${data.text}</div>
          </div>
          <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>
      `;
      notificationContainer.appendChild(toastEl);
      setTimeout(() => toastEl.remove(), 7000);
    }
  });
}

/**
 * Auto-Dismiss Alerts
 */
function initAutoDismissAlerts() {
  const alerts = document.querySelectorAll('.alert-dismissible');
  alerts.forEach(alert => {
    setTimeout(() => {
      if (alert && alert.parentNode && typeof bootstrap !== 'undefined') {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, 9000);
  });
}

/**
 * Global CAPTCHA Refresh Helper
 */
function refreshCaptcha(imgId = 'captchaImage') {
  const container = document.getElementById('captchaContainer');
  if (container) {
    fetch('/auth/captcha?t=' + Date.now())
      .then(res => res.text())
      .then(svg => {
        container.innerHTML = svg;
      })
      .catch(() => {
        location.reload();
      });
  } else {
    location.reload();
  }
}
