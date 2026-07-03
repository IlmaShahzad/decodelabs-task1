// =========================================
//  SafeRoute - Emergency Contacts JS
// =========================================

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  loadContacts();
  setupNotifyToggle();
});

async function loadContacts() {
  const list = document.getElementById('contactsList');
  const counter = document.getElementById('contactCount');

  try {
    const res = await fetch(`${API_BASE}/contacts`, { headers: authHeaders() });
    const data = await res.json();

    counter.textContent = `${data.count || 0} / 5`;

    if (!data.contacts || data.contacts.length === 0) {
      list.innerHTML = `
        <div style="text-align:center;padding:48px;color:#94a3b8;">
          <i class="fa-solid fa-address-book" style="font-size:3rem;margin-bottom:16px;display:block;opacity:0.4;"></i>
          <div style="font-size:0.9rem;font-weight:600;color:#64748b;margin-bottom:8px;">No emergency contacts yet</div>
          <div style="font-size:0.82rem;">Add contacts above so they can be notified during an SOS emergency.</div>
        </div>`;
      return;
    }

    const avatarColors = ['#e91e8c', '#7c3aed', '#16a34a', '#0891b2', '#d97706'];
    const relIcons = { family: 'fa-house', friend: 'fa-user-friends', colleague: 'fa-briefcase', other: 'fa-user' };

    list.innerHTML = data.contacts.map((c, idx) => `
      <div class="contact-card" id="contact-${c._id}">
        <div class="contact-avatar" style="background:${avatarColors[idx % avatarColors.length]};">
          ${c.name.charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;">
          <div class="contact-name">${c.name}</div>
          <div class="contact-meta">
            <span><i class="fa-solid fa-phone" style="width:12px;"></i> ${c.phone}</span>
            ${c.email ? `<span><i class="fa-solid fa-envelope" style="width:12px;"></i> ${c.email}</span>` : ''}
            <span>
              <i class="fa-solid ${relIcons[c.relationship] || 'fa-user'}" style="width:12px;"></i>
              ${cap(c.relationship)}
            </span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${c.notifyOnSOS
            ? '<span class="badge badge-success"><i class="fa-solid fa-bell"></i> SOS Notify ON</span>'
            : '<span class="badge badge-gray"><i class="fa-regular fa-bell-slash"></i> SOS Notify OFF</span>'}
        </div>
        <div class="contact-actions">
          <button class="btn btn-secondary btn-sm" onclick="openEditModal('${c._id}','${escHtml(c.name)}','${escHtml(c.phone)}','${escHtml(c.email || '')}','${c.relationship}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteContact('${c._id}','${escHtml(c.name)}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;">Failed to load contacts. Make sure the backend is running.</div>';
  }
}

function setupNotifyToggle() {
  const toggle = document.getElementById('notifyToggle');
  const input = document.getElementById('notifyOnSOS');

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('on');
    input.value = toggle.classList.contains('on') ? 'true' : 'false';
  });
}

document.getElementById('addContactForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('contactName').value.trim();
  const phone = document.getElementById('contactPhone').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const relationship = document.getElementById('contactRelationship').value;
  const notifyOnSOS = document.getElementById('notifyOnSOS').value === 'true';
  const alertBox = document.getElementById('addAlertBox');
  const btn = document.getElementById('addContactBtn');
  const addBtnText = document.getElementById('addBtnText');
  const addBtnLoader = document.getElementById('addBtnLoader');

  alertBox.innerHTML = '';

  addBtnText.classList.add('hidden');
  addBtnLoader.classList.remove('hidden');
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/contacts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, phone, email, relationship, notifyOnSOS }),
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('addContactForm').reset();
      document.getElementById('notifyToggle').classList.add('on');
      document.getElementById('notifyOnSOS').value = 'true';
      alertBox.innerHTML = `<div class="alert alert-success"><i class="fa-solid fa-check-circle"></i> ${name} added as emergency contact!</div>`;
      setTimeout(() => { alertBox.innerHTML = ''; }, 3000);
      loadContacts();
    } else {
      alertBox.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-xmark"></i> ${data.message}</div>`;
    }
  } catch {
    alertBox.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-wifi"></i> Cannot connect to server.</div>';
  } finally {
    addBtnText.classList.remove('hidden');
    addBtnLoader.classList.add('hidden');
    btn.disabled = false;
  }
});

function openEditModal(id, name, phone, email, relationship) {
  document.getElementById('editContactId').value = id;
  document.getElementById('editName').value = name;
  document.getElementById('editPhone').value = phone;
  document.getElementById('editEmail').value = email;
  document.getElementById('editRelationship').value = relationship;
  document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
}

document.getElementById('editContactForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('editContactId').value;
  const name = document.getElementById('editName').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const relationship = document.getElementById('editRelationship').value;

  try {
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name, phone, email, relationship }),
    });

    const data = await res.json();
    if (data.success) {
      closeEditModal();
      loadContacts();
      showToast('Contact updated successfully!', 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch {
    showToast('Failed to update contact. Check connection.', 'error');
  }
});

async function deleteContact(id, name) {
  if (!confirm(`Remove "${name}" from your emergency contacts?`)) return;

  try {
    const res = await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    const data = await res.json();
    if (data.success) {
      loadContacts();
      showToast(`${name} removed from contacts.`, 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch {
    showToast('Failed to delete contact.', 'error');
  }
}

// ---- Helpers ----
function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function escHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}
