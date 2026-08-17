// Redirect to login if not authenticated
const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "index.html";
}

const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

// ---- Helper: authenticated fetch, reused by every page ----
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
    return null;
  }

  return res;
}

// ---- Logout, wired up wherever a #logout-btn exists ----
function setupLogout() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
  });
}

// ---- Profile dropdown toggle, wired up wherever it exists ----
function setupProfileMenu() {
  const profileBtn = document.getElementById("profile-btn");
  const dropdown = document.getElementById("profile-dropdown");
  if (!profileBtn || !dropdown) return;

  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== profileBtn) {
      dropdown.classList.remove("open");
    }
  });
}

// ---- Auto-grow a textarea as the person types, instead of scrolling inside it ----
function setupAutoGrowTextarea(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const resize = () => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };

  el.addEventListener("input", resize);
  resize();
}

// ============================================================
// NOTIFICATIONS — bell icon, dropdown, badge, browser popups
// ============================================================

let knownNotificationIds = new Set();
let notificationsInitialized = false;

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function notifIcon(type) {
  if (type === "completed") return "✅";
  if (type === "due_soon") return "⏰";
  if (type === "due_today") return "🔥";
  if (type === "overdue") return "⚠️";
  return "🆕";
}

async function loadNotifications() {
  const badge = document.getElementById("notif-badge");
  const list = document.getElementById("notif-list");
  if (!badge || !list) return; // this page doesn't have the bell — skip quietly

  const res = await apiFetch("/notifications");
  if (!res) return;
  const data = await res.json();

  // Badge count
  if (data.unreadCount > 0) {
    badge.textContent = data.unreadCount > 9 ? "9+" : data.unreadCount;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }

  // Fire a real browser notification for anything new since last check
  if (notificationsInitialized) {
    data.notifications.forEach((n) => {
      if (!knownNotificationIds.has(n._id) && !n.read) {
        showBrowserNotification(n.message);
      }
    });
  }
  knownNotificationIds = new Set(data.notifications.map((n) => n._id));
  notificationsInitialized = true;

  // Render list
  if (data.notifications.length === 0) {
    list.innerHTML = `<p class="notif-empty">No notifications yet.</p>`;
    return;
  }

  list.innerHTML = data.notifications
    .map(
      (n) => `
      <div class="notif-item ${n.read ? "" : "unread"} ${n.type === "overdue" ? "notif-overdue" : ""}" data-id="${n._id}">
        <span class="notif-icon">${notifIcon(n.type)}</span>
        <div class="notif-body">
          <p class="notif-message">${escapeNotifHtml(n.message)}</p>
          <span class="notif-time">${timeAgo(n.createdAt)}</span>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".notif-item.unread").forEach((item) => {
    item.addEventListener("click", async () => {
      await apiFetch(`/notifications/${item.dataset.id}/read`, { method: "PUT" });
      loadNotifications();
    });
  });
}

function escapeNotifHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function requestBrowserNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showBrowserNotification(message) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  new Notification("Flowlist", {
    body: message,
    icon: "",
  });
}

function setupNotificationMenu() {
  const notifBtn = document.getElementById("notif-btn");
  const dropdown = document.getElementById("notif-dropdown");
  if (!notifBtn || !dropdown) return; // page has no bell — skip quietly

  requestBrowserNotificationPermission();

  notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== notifBtn) {
      dropdown.classList.remove("open");
    }
  });

  const markAllBtn = document.getElementById("mark-all-read-btn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await apiFetch("/notifications/read-all", { method: "PUT" });
      loadNotifications();
    });
  }

  loadNotifications();
  // Check for new notifications every 30 seconds
  setInterval(loadNotifications, 30000);
}

// ============================================================
// WORKSPACES — dynamic tabs, add (+), delete (×)
// ============================================================

let userWorkspaces = [];
let currentWorkspaceFilter = "";
// Pages set this to their own loadTasks/loadAllTasks so tabs can refresh the list
window.onWorkspaceFilterChange = null;

async function loadWorkspaces() {
  const res = await apiFetch("/workspaces");
  if (!res) return;
  userWorkspaces = await res.json();

  // Only render tabs if this page actually has a tabs container
  // (Dashboard and My Tasks do; Kanban and Profile don't).
  const container = document.getElementById("workspace-tabs");
  if (container) {
    renderWorkspaceTabs();
  }

  // The Workspace dropdown inside the Add/Edit Task form exists on every
  // page that has that form (Dashboard, My Tasks, Kanban) — populate it
  // regardless of whether tabs exist on this page.
  populateWorkspaceSelect();

  if (window.onWorkspacesLoaded) window.onWorkspacesLoaded();
}

function renderWorkspaceTabs() {
  const container = document.getElementById("workspace-tabs");
  if (!container) return;

  const tabsHtml = userWorkspaces
    .map(
      (w) => `
      <button class="workspace-tab ${currentWorkspaceFilter === w.name ? "active" : ""}" data-workspace="${escapeHtml(w.name)}">
        ${w.icon} ${escapeHtml(w.name)}
        <span class="workspace-delete" data-id="${w._id}" title="Delete workspace">×</span>
      </button>
    `
    )
    .join("");

  container.innerHTML = `
    <button class="workspace-tab ${currentWorkspaceFilter === "" ? "active" : ""}" data-workspace="">All</button>
    ${tabsHtml}
    <button class="workspace-tab workspace-add" id="add-workspace-tab-btn" title="Add workspace">+</button>
  `;

  container.querySelectorAll(".workspace-tab[data-workspace]").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      if (e.target.classList.contains("workspace-delete")) return; // handled separately below
      currentWorkspaceFilter = tab.dataset.workspace;
      renderWorkspaceTabs();
      if (window.onWorkspaceFilterChange) window.onWorkspaceFilterChange();
    });
  });

  container.querySelectorAll(".workspace-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDeleteWorkspaceModal(btn.dataset.id);
    });
  });

  const addBtn = document.getElementById("add-workspace-tab-btn");
  if (addBtn) addBtn.addEventListener("click", openAddWorkspaceModal);
}

function populateWorkspaceSelect() {
  const select = document.getElementById("task-workspace");
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = userWorkspaces
    .map((w) => `<option value="${escapeHtml(w.name)}">${w.icon} ${escapeHtml(w.name)}</option>`)
    .join("");

  if (userWorkspaces.some((w) => w.name === currentValue)) {
    select.value = currentValue;
  }
}

// ---- Add workspace popup ----
let selectedNewWorkspaceIcon = "⚪";

function openAddWorkspaceModal() {
  const modal = document.getElementById("add-workspace-modal");
  if (!modal) return;
  document.getElementById("add-workspace-form").reset();
  document.getElementById("workspace-error").textContent = "";
  document.querySelectorAll(".icon-option").forEach((b) => b.classList.remove("selected"));
  document.querySelector('.icon-option[data-icon="⚪"]')?.classList.add("selected");
  selectedNewWorkspaceIcon = "⚪";
  modal.classList.add("open");
}

function closeAddWorkspaceModal() {
  document.getElementById("add-workspace-modal")?.classList.remove("open");
}

function setupWorkspaceModals() {
  const addModal = document.getElementById("add-workspace-modal");
  const deleteModal = document.getElementById("delete-workspace-modal");
  if (!addModal || !deleteModal) return; // page has no workspace UI

  document.getElementById("cancel-add-workspace-btn").addEventListener("click", closeAddWorkspaceModal);
  addModal.addEventListener("click", (e) => {
    if (e.target.id === "add-workspace-modal") closeAddWorkspaceModal();
  });

  document.querySelectorAll(".icon-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".icon-option").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedNewWorkspaceIcon = btn.dataset.icon;
    });
  });

  document.getElementById("add-workspace-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("workspace-error");
    errorEl.textContent = "";

    const name = document.getElementById("new-workspace-name").value.trim();

    const res = await apiFetch("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, icon: selectedNewWorkspaceIcon }),
    });

    if (!res) return;
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.msg || "Could not create workspace";
      return;
    }

    closeAddWorkspaceModal();
    loadWorkspaces();
  });

  let pendingDeleteWorkspaceId = null;

  window.openDeleteWorkspaceModal = (id) => {
    pendingDeleteWorkspaceId = id;
    deleteModal.classList.add("open");
  };

  const closeDeleteWorkspaceModal = () => {
    deleteModal.classList.remove("open");
    pendingDeleteWorkspaceId = null;
  };

  document.getElementById("cancel-delete-workspace-btn").addEventListener("click", closeDeleteWorkspaceModal);
  deleteModal.addEventListener("click", (e) => {
    if (e.target.id === "delete-workspace-modal") closeDeleteWorkspaceModal();
  });

  document.getElementById("confirm-delete-workspace-btn").addEventListener("click", async () => {
    if (!pendingDeleteWorkspaceId) return;

    const deletedWorkspace = userWorkspaces.find((w) => w._id === pendingDeleteWorkspaceId);

    await apiFetch(`/workspaces/${pendingDeleteWorkspaceId}`, { method: "DELETE" });
    closeDeleteWorkspaceModal();

    if (deletedWorkspace && currentWorkspaceFilter === deletedWorkspace.name) {
      currentWorkspaceFilter = "";
    }

    await loadWorkspaces();
    if (window.onWorkspaceFilterChange) window.onWorkspaceFilterChange();
  });
}

function openDeleteWorkspaceModal(id) {
  window.openDeleteWorkspaceModal(id);
}

// Run on every page that includes this script
document.addEventListener("DOMContentLoaded", () => {
  setupLogout();
  setupProfileMenu();
  setupNotificationMenu();
  setupWorkspaceModals();
  loadWorkspaces();

  const nameEl = document.getElementById("user-name");
  if (nameEl) nameEl.textContent = `👋 ${currentUser.name || ""}`;
});
