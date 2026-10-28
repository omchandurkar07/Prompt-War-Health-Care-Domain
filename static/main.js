// ============================================
// UltraCare HMS — Main JavaScript
// ============================================

// ── Navbar Toggle (mobile) ──
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) menu.classList.remove('open');
    });
  }

  // ── Notification System ──
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  const markAllBtn = document.getElementById('markAllRead');

  if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('show');
      if (notifDropdown.classList.contains('show')) fetchNotifications();
    });
    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target)) notifDropdown.classList.remove('show');
    });
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async () => {
        await fetch('/api/notifications/read-all', { method: 'POST' });
        fetchNotifications();
      });
    }
    // Poll every 30 seconds
    fetchNotificationCount();
    setInterval(fetchNotificationCount, 30000);
  }

  async function fetchNotificationCount() {
    try {
      const r = await fetch('/api/notifications');
      const data = await r.json();
      if (notifBadge) {
        if (data.unread_count > 0) {
          notifBadge.textContent = data.unread_count;
          notifBadge.style.display = 'block';
        } else {
          notifBadge.style.display = 'none';
        }
      }
    } catch (e) {}
  }

  async function fetchNotifications() {
    try {
      const r = await fetch('/api/notifications');
      const data = await r.json();
      if (!data.notifications || data.notifications.length === 0) {
        notifList.innerHTML = '<p class="notif-empty">No notifications</p>';
        return;
      }
      notifList.innerHTML = data.notifications.map(n => {
        const timeAgo = getTimeAgo(n.created_at);
        return `<div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="handleNotifClick(${n.id}, '${n.link || ''}')">
          <h5>${n.title}</h5>
          <p>${n.message || ''}</p>
          <span class="notif-time">${timeAgo}</span>
        </div>`;
      }).join('');
      if (notifBadge) {
        if (data.unread_count > 0) {
          notifBadge.textContent = data.unread_count;
          notifBadge.style.display = 'block';
        } else {
          notifBadge.style.display = 'none';
        }
      }
    } catch (e) {}
  }

  // ── Auto-dismiss flash messages ──
  document.querySelectorAll('.alert').forEach(el => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 300);
    }, 5000);
  });
});

// ── Global: Handle notification click ──
async function handleNotifClick(id, link) {
  await fetch(`/api/notification/${id}/read`, { method: 'POST' });
  if (link) window.location.href = link;
  else location.reload();
}

// ── Time ago helper ──
function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ── Password Visibility Toggle ──
function togglePasswordVisibility(fieldId, toggleEl) {
  const passwordField = document.getElementById(fieldId);
  if (!passwordField) return;
  if (passwordField.type === 'password') {
    passwordField.type = 'text';
    toggleEl.textContent = '🙈';
    toggleEl.title = 'Hide password';
  } else {
    passwordField.type = 'password';
    toggleEl.textContent = '👁️';
    toggleEl.title = 'Show password';
  }
}
