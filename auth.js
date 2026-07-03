// =========================================
//  SafeRoute - Auth Utilities
// =========================================

const API_BASE = 'http://localhost:5000/api';

// Get stored token
function getToken() {
  return localStorage.getItem('saferoute_token');
}

// Get stored user
function getUser() {
  const u = localStorage.getItem('saferoute_user');
  return u ? JSON.parse(u) : null;
}

// Auth headers
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

// Logout
function logout() {
  localStorage.removeItem('saferoute_token');
  localStorage.removeItem('saferoute_user');
  window.location.href = 'login.html';
}

// Redirect unauthenticated users (call on protected pages)
function requireAuth() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Redirect if already logged in (call on login/register pages)
function redirectIfLoggedIn() {
  const token = getToken();
  const user = getUser();
  if (token && user) {
    window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
  }
}

// Wire up logout buttons
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
});
