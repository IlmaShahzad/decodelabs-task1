// =========================================
//  SafeRoute - Admin Dashboard JS
// =========================================

let allIncidents = [];
let allUsers = [];
let typeChart, severityChart, trendChart;

document.addEventListener('DOMContentLoaded', async () => {
  // Check admin auth
  const user = getUser();
  if (!user) return (window.location.href = 'login.html');
  if (user.role !== 'admin') {
    alert('Access denied. Admins only.');
    return (window.location.href = 'dashboard.html');
  }

  await loadAdminData();
});

async function loadAdminData() {
  await Promise.all([loadStats(), loadIncidents(), loadUsers(), loadSOSAlerts()]);
}

// ---- Stats ----
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() });
    const data = await res.json();

    if (!data.success) return;
    const s = data.stats;

    document.getElementById('totalUsers').textContent = s.totalUsers;
    document.getElementById('totalIncidents').textContent = s.totalIncidents;
    document.getElementById('activeAlerts').textContent = s.activeAlerts;
    document.getElementById('verifiedIncidents').textContent = s.verifiedIncidents;

    renderCharts(s);
    renderHighRiskAreas(s);
  } catch (err) {
    console.error('Stats load failed:', err);
  }
}

// ---- Charts ----
function renderCharts(stats) {
  // Destroy existing
  if (typeChart) typeChart.destroy();
  if (severityChart) severityChart.destroy();
  if (trendChart) trendChart.destroy();

  // Incident by Type (Doughnut)
  const typeLabels = (stats.incidentsByType || []).map(t =>
    t._id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  );
  const typeCounts = (stats.incidentsByType || []).map(t => t.count);
  const typeColors = ['#e91e8c', '#7c3aed', '#dc2626', '#d97706', '#16a34a', '#0891b2', '#64748b'];

  const typeCtx = document.getElementById('typeChart').getContext('2d');
  typeChart = new Chart(typeCtx, {
    type: 'doughnut',
    data: {
      labels: typeLabels.length ? typeLabels : ['No data'],
      datasets: [{
        data: typeCounts.length ? typeCounts : [1],
        backgroundColor: typeColors,
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { font: { family: 'Inter', size: 11 }, padding: 12 } },
      },
    },
  });

  // Incident by Severity (Bar)
  const sevData = { low: 0, medium: 0, high: 0 };
  (stats.incidentsBySeverity || []).forEach(s => { if (sevData[s._id] !== undefined) sevData[s._id] = s.count; });

  const sevCtx = document.getElementById('severityChart').getContext('2d');
  severityChart = new Chart(sevCtx, {
    type: 'bar',
    data: {
      labels: ['Low', 'Medium', 'High'],
      datasets: [{
        label: 'Incidents',
        data: [sevData.low, sevData.medium, sevData.high],
        backgroundColor: ['#dcfce7', '#fef3c7', '#fee2e2'],
        borderColor: ['#16a34a', '#d97706', '#dc2626'],
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Inter' } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', weight: '600' } } },
      },
    },
  });

  // Daily trend (Line)
  const trend = stats.dailyTrend || [];
  const trendLabels = trend.map(t => {
    const d = new Date(t._id);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const trendCounts = trend.map(t => t.count);

  // Fill missing days if empty
  if (!trendLabels.length) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    trendLabels.push(...days);
    trendCounts.push(...Array(7).fill(0));
  }

  const trendCtx = document.getElementById('trendChart').getContext('2d');
  trendChart = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'Incidents',
        data: trendCounts,
        borderColor: '#e91e8c',
        backgroundColor: 'rgba(233,30,140,0.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#e91e8c',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Inter' } } },
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } },
      },
    },
  });
}

function renderHighRiskAreas(stats) {
  const container = document.getElementById('highRiskAreas');
  const typeData = stats.incidentsByType || [];

  if (!typeData.length) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.875rem;">No incident data available</div>';
    return;
  }

  const max = Math.max(...typeData.map(t => t.count), 1);
  container.innerHTML = typeData.map(item => {
    const pct = Math.round((item.count / max) * 100);
    const label = item._id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `
      <div class="risk-area-item">
        <div class="risk-bar-wrap">
          <div class="risk-bar-label">
            <span style="font-size:0.82rem;">${label}</span>
            <span style="color:#e91e8c;font-size:0.82rem;">${item.count}</span>
          </div>
          <div class="risk-bar">
            <div class="risk-bar-fill" style="width:${pct}%;"></div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ---- Incidents ----
async function loadIncidents() {
  try {
    const res = await fetch(`${API_BASE}/admin/incidents?limit=50`, { headers: authHeaders() });
    const data = await res.json();
    allIncidents = data.incidents || [];
    renderIncidentsTable(allIncidents);
  } catch (err) {
    document.getElementById('incidentsTable').innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">Failed to load incidents.</td></tr>';
  }
}

function renderIncidentsTable(incidents) {
  const tbody = document.getElementById('incidentsTable');

  if (!incidents.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8;">No incidents found.</td></tr>';
    return;
  }

  tbody.innerHTML = incidents.map(inc => `
    <tr>
      <td><span style="font-size:0.8rem;font-weight:600;">${formatType(inc.incidentType)}</span></td>
      <td style="max-width:200px;">
        <div style="font-size:0.82rem;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${inc.description || '—'}</div>
      </td>
      <td style="font-size:0.8rem;color:#64748b;">${inc.location?.address?.slice(0, 30) || `${inc.location?.lat?.toFixed(3)}, ${inc.location?.lng?.toFixed(3)}`}</td>
      <td><span class="severity-badge severity-${inc.severity}">${cap(inc.severity)}</span></td>
      <td><span class="status-badge status-${inc.status}">${cap(inc.status)}</span></td>
      <td style="font-size:0.8rem;color:#94a3b8;">${timeAgo(inc.createdAt)}</td>
      <td>
        <div class="table-actions">
          ${inc.status === 'pending' ? `
            <button class="act-btn verify" onclick="verifyIncident('${inc._id}','verified')">Verify</button>
            <button class="act-btn reject" onclick="verifyIncident('${inc._id}','rejected')">Reject</button>
          ` : `<span style="font-size:0.78rem;color:#94a3b8;">${cap(inc.status)}</span>`}
        </div>
      </td>
    </tr>
  `).join('');
}

async function verifyIncident(id, status) {
  try {
    const res = await fetch(`${API_BASE}/incidents/${id}/verify`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Incident ${status}!`, status === 'verified' ? 'success' : 'warning');
      await loadIncidents();
      await loadStats();
    } else {
      showToast(data.message, 'error');
    }
  } catch {
    showToast('Action failed. Check connection.', 'error');
  }
}

function filterIncidents() {
  const statusFilter = document.getElementById('incidentStatusFilter').value;
  const severityFilter = document.getElementById('incidentSeverityFilter').value;
  const search = document.getElementById('incidentSearch').value.toLowerCase();

  const filtered = allIncidents.filter(inc => {
    const matchStatus = !statusFilter || inc.status === statusFilter;
    const matchSeverity = !severityFilter || inc.severity === severityFilter;
    const matchSearch = !search ||
      inc.incidentType.includes(search) ||
      inc.description?.toLowerCase().includes(search) ||
      inc.location?.address?.toLowerCase().includes(search);
    return matchStatus && matchSeverity && matchSearch;
  });

  renderIncidentsTable(filtered);
}

// ---- Users ----
async function loadUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
    const data = await res.json();
    allUsers = data.users || [];
    renderUsersTable(allUsers);
  } catch {
    document.getElementById('usersTable').innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">Failed to load users.</td></tr>';
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTable');

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8;">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#e91e8c,#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;flex-shrink:0;">
            ${u.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div class="td-name">${u.name}</div>
        </div>
      </td>
      <td class="td-email">${u.email}</td>
      <td style="font-size:0.82rem;color:#64748b;">${u.phone || '—'}</td>
      <td>
        <span class="badge ${u.role === 'admin' ? 'badge-secondary' : 'badge-info'}">${cap(u.role)}</span>
      </td>
      <td>
        <span class="status-badge ${u.isActive ? 'status-resolved' : 'status-rejected'}">
          ${u.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style="font-size:0.8rem;color:#94a3b8;">${new Date(u.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="act-btn ${u.isActive ? 'deactivate' : 'verify'}" onclick="toggleUserStatus('${u._id}',${!u.isActive})">
          ${u.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function toggleUserStatus(id, isActive) {
  try {
    const res = await fetch(`${API_BASE}/users/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`User ${isActive ? 'activated' : 'deactivated'}!`, 'success');
      loadUsers();
    } else {
      showToast(data.message, 'error');
    }
  } catch {
    showToast('Action failed.', 'error');
  }
}

function filterUsers() {
  const search = document.getElementById('userSearch').value.toLowerCase();
  const filtered = allUsers.filter(u =>
    u.name?.toLowerCase().includes(search) ||
    u.email?.toLowerCase().includes(search) ||
    u.phone?.includes(search)
  );
  renderUsersTable(filtered);
}

// ---- SOS Alerts ----
async function loadSOSAlerts() {
  try {
    const res = await fetch(`${API_BASE}/admin/sos-alerts`, { headers: authHeaders() });
    const data = await res.json();
    renderSOSTable(data.alerts || []);
  } catch {
    document.getElementById('sosAlertsTable').innerHTML =
      '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Failed to load SOS alerts.</td></tr>';
  }
}

function renderSOSTable(alerts) {
  const tbody = document.getElementById('sosAlertsTable');

  if (!alerts.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No SOS alerts found.</td></tr>';
    return;
  }

  tbody.innerHTML = alerts.map(a => `
    <tr>
      <td>
        <div class="td-name">${a.userId?.name || 'Unknown'}</div>
        <div class="td-email">${a.userId?.email || ''}</div>
      </td>
      <td style="font-size:0.82rem;color:#64748b;">
        ${a.location?.address || `${a.location?.lat?.toFixed(4) || '—'}, ${a.location?.lng?.toFixed(4) || ''}`}
        ${a.location?.lat ? `<br><a href="https://www.google.com/maps?q=${a.location.lat},${a.location.lng}" target="_blank" style="font-size:0.75rem;color:#e91e8c;">View on Map</a>` : ''}
      </td>
      <td style="font-size:0.82rem;">${a.contactsNotified?.length || 0} contact(s)</td>
      <td><span class="status-badge status-${a.status}">${cap(a.status)}</span></td>
      <td style="font-size:0.8rem;color:#94a3b8;">${new Date(a.createdAt).toLocaleString()}</td>
    </tr>
  `).join('');
}

// ---- Tab Switching ----
const tabTitles = {
  overview: { title: 'Admin Overview', sub: 'Platform statistics and safety insights', icon: 'fa-chart-pie' },
  incidents: { title: 'Incident Management', sub: 'Review and verify reported incidents', icon: 'fa-triangle-exclamation' },
  users: { title: 'User Management', sub: 'Manage registered users and accounts', icon: 'fa-users' },
  sos: { title: 'SOS Alerts', sub: 'Monitor emergency alerts across the platform', icon: 'fa-bell' },
};

function switchTab(tabName, el) {
  // Hide all panes
  document.querySelectorAll('.tab-pane').forEach(p => (p.style.display = 'none'));
  // Show selected
  const pane = document.getElementById(`tab-${tabName}`);
  if (pane) pane.style.display = 'block';

  // Update nav active state
  document.querySelectorAll('.sidebar-nav a[data-tab]').forEach(a => a.classList.remove('active'));
  if (el) el.classList.add('active');

  // Update topbar
  const meta = tabTitles[tabName];
  if (meta) {
    document.getElementById('tabTitle').innerHTML = `<i class="fa-solid ${meta.icon}" style="color:#e91e8c;margin-right:8px;"></i>${meta.title}`;
    document.getElementById('tabSubtitle').textContent = meta.sub;
  }

  // Prevent default link behavior
  return false;
}

// ---- Helpers ----
function formatType(type) {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#0891b2' };
  toast.innerHTML = `<i class="fa-solid ${icons[type]}" style="color:${colors[type]};font-size:1.1rem;"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
