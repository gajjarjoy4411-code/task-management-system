// auth guard, apiFetch, logout, profile menu, auto-grow textarea
// are all set up by common.js

// ---- Drawer (centered popup) open/close ----
const drawer = document.getElementById("add-task-drawer");
const drawerTitle = document.getElementById("drawer-title");
const submitBtn = document.getElementById("task-submit-btn");

const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-description");
const deadlineInput = document.getElementById("task-deadline");
const workspaceInput = document.getElementById("task-workspace");
const priorityInput = document.getElementById("task-priority");

// ---- Delete confirmation modal ----
const deleteModal = document.getElementById("delete-modal");
let pendingDeleteId = null;

function openDeleteModal(taskId) {
  pendingDeleteId = taskId;
  deleteModal.classList.add("open");
}

function closeDeleteModal() {
  deleteModal.classList.remove("open");
  pendingDeleteId = null;
}

document.getElementById("cancel-delete-btn").addEventListener("click", closeDeleteModal);

deleteModal.addEventListener("click", (e) => {
  if (e.target.id === "delete-modal") closeDeleteModal();
});

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  await apiFetch(`/tasks/${pendingDeleteId}`, { method: "DELETE" });
  closeDeleteModal();
  loadTasks();
});

function setFieldsDisabled(disabled) {
  titleInput.disabled = disabled;
  descInput.disabled = disabled;
  deadlineInput.disabled = disabled;
  workspaceInput.disabled = disabled;
  document.querySelectorAll(".priority-option").forEach((btn) => {
    btn.disabled = disabled;
  });
  submitBtn.style.display = disabled ? "none" : "block";
}

function setPriority(value) {
  priorityInput.value = value;
  document.querySelectorAll(".priority-option").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.priority === value);
  });
}

document.querySelectorAll(".priority-option").forEach((btn) => {
  btn.addEventListener("click", () => setPriority(btn.dataset.priority));
});

function openDrawerForNewTask() {
  document.getElementById("task-form").reset();
  document.getElementById("task-id").value = "";
  workspaceInput.value = currentWorkspaceFilter || "Personal";
  setPriority("medium");
  drawerTitle.textContent = "New Task";
  submitBtn.textContent = "+ Add Task";
  setFieldsDisabled(false);

  drawer.classList.add("open");
  titleInput.focus();
  setupAutoGrowTextarea("task-description");
}

function openDrawerForEdit(task) {
  fillFormWith(task);
  drawerTitle.textContent = "Edit Task";
  submitBtn.textContent = "Save Changes";
  setFieldsDisabled(false);

  drawer.classList.add("open");
  setupAutoGrowTextarea("task-description");
}

function openDrawerForView(task) {
  fillFormWith(task);
  drawerTitle.textContent = "View Task";
  setFieldsDisabled(true);

  drawer.classList.add("open");
  setupAutoGrowTextarea("task-description");
}

function fillFormWith(task) {
  document.getElementById("task-id").value = task._id;
  titleInput.value = task.title;
  descInput.value = task.description || "";
  workspaceInput.value = task.workspace || "Personal";
  setPriority(task.priority || "medium");
  deadlineInput.value = task.deadline
    ? new Date(task.deadline).toISOString().split("T")[0]
    : "";
}

function closeDrawer() {
  drawer.classList.remove("open");
  document.getElementById("task-error").textContent = "";
  setFieldsDisabled(false);
}

document.getElementById("open-drawer-btn").addEventListener("click", openDrawerForNewTask);
document.getElementById("close-drawer-btn").addEventListener("click", closeDrawer);

drawer.addEventListener("click", (e) => {
  if (e.target.id === "add-task-drawer") closeDrawer();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (drawer.classList.contains("open")) closeDrawer();
    if (calendarModal.classList.contains("open")) closeCalendarModal();
  }
});

// ---- Workspace filtering is handled by common.js (tabs, +, delete) ----
// This page just needs to refresh its task list when the filter changes:
window.onWorkspaceFilterChange = () => loadTasks();
window.onWorkspacesLoaded = () => loadTasks();

// ---- Load stats ----
async function loadStats() {
  const res = await apiFetch("/tasks/stats/summary");
  if (!res) return;
  const stats = await res.json();

  document.getElementById("stat-total").textContent = stats.total;
  document.getElementById("stat-pending").textContent = stats.pending;
  document.getElementById("stat-inprogress").textContent = stats.inProgress;
  document.getElementById("stat-completed").textContent = stats.completed;

  setTrend("trend-total", stats.totalNewThisWeek);
  setTrend("trend-pending", stats.pendingNewThisWeek);
  setTrend("trend-inprogress", stats.inProgressNewThisWeek);
  setTrend("trend-completed", stats.completedNewThisWeek);
}

function setTrend(elId, count) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (count > 0) {
    el.textContent = `↑ +${count} this week`;
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}

// ---- Load tasks ----
let allTasksCache = [];

async function loadTasks() {
  const search = document.getElementById("search-input").value;
  const status = document.getElementById("status-filter").value;
  const priority = document.getElementById("priority-filter").value;

  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (status) params.append("status", status);
  if (priority) params.append("priority", priority);
  if (currentWorkspaceFilter) params.append("workspace", currentWorkspaceFilter);

  const res = await apiFetch(`/tasks?${params.toString()}`);
  if (!res) return;
  const tasks = await res.json();

  allTasksCache = sortByPriority(tasks);
  renderTasks(allTasksCache);
  loadStats();
}

function sortByPriority(tasks) {
  const order = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    // Starred tasks always float to the top, regardless of priority
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });
}
// ---- Render tasks ----
function renderTasks(tasks) {
  const list = document.getElementById("task-list");
  const emptyMsg = document.getElementById("empty-msg");

  list.innerHTML = "";

  if (tasks.length === 0) {
    list.appendChild(emptyMsg);
    emptyMsg.style.display = "block";
    return;
  }

 const workspaceIcons = {};
userWorkspaces.forEach((w) => {
  workspaceIcons[w.name] = w.icon;
});

  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = `task-card ${task.status === "completed" ? "completed" : ""}`;

 const priorityFlags = { high: "🚩", medium: "🚩", low: "🚩" };
    const priorityText = { high: "High", medium: "Medium", low: "Low" };
    const priorityHtml = task.priority
      ? `<span class="meta-priority priority-${task.priority}">${priorityFlags[task.priority]} ${priorityText[task.priority] || task.priority}</span>`
      : `<span class="meta-priority"></span>`;

    const workspaceHtml = task.workspace
      ? `<span class="meta-workspace">${workspaceIcons[task.workspace] || "⚪"} ${task.workspace}</span>`
      : `<span class="meta-workspace"></span>`;

    const deadlineHtml = task.deadline
      ? `<span class="meta-date">📅 ${new Date(task.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>`
      : `<span class="meta-date"></span>`;

    card.innerHTML = `
      <div class="task-info">
        <div class="task-title">
          
          ${escapeHtml(task.title)}
        </div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ""}
        <div class="task-meta">
          <span class="badge ${task.status}">${task.status.replace("-", " ")}</span>
          ${priorityHtml}
          ${workspaceHtml}
          ${deadlineHtml}
        </div>
      </div>
      <div class="task-actions">
      <button class="star-btn ${task.starred ? "starred" : ""}" data-id="${task._id}" title="Star this task">${task.starred ? "⭐" : "☆"}</button>
        <select class="status-select" data-id="${task._id}">
          <option value="pending" ${task.status === "pending" ? "selected" : ""}>Pending</option>
          <option value="in-progress" ${task.status === "in-progress" ? "selected" : ""}>In Progress</option>
          <option value="completed" ${task.status === "completed" ? "selected" : ""}>Completed</option>
        </select>
        <div class="kebab-menu">
          <button class="kebab-btn" data-id="${task._id}" title="More actions">⋮</button>
          <div class="kebab-dropdown" id="kebab-${task._id}">
            <button class="kebab-item view" data-id="${task._id}">👁️ View</button>
            <button class="kebab-item edit" data-id="${task._id}">✏️ Edit</button>
            <button class="kebab-item delete" data-id="${task._id}">🗑️ Delete</button>
          </div>
        </div>
      </div>
    `;

    list.appendChild(card);
  });

  attachTaskActionListeners();
}
function attachTaskActionListeners() {
  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const task = allTasksCache.find((t) => t._id === id);
      if (!task) return;

      await apiFetch(`/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ starred: !task.starred }),
      });
      loadTasks();
    });
  });

  document.querySelectorAll(".status-select").forEach((select) => {

  
    select.addEventListener("change", async (e) => {
      await apiFetch(`/tasks/${e.target.dataset.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: e.target.value }),
      });
      loadTasks();
      if (fullCalendarInstance) refreshCalendarEvents();
    });
  });

  document.querySelectorAll(".kebab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById(`kebab-${btn.dataset.id}`);
      const card = btn.closest(".task-card");
      const wasOpen = dropdown.classList.contains("open");

      closeAllKebabs();

      if (!wasOpen) {
        dropdown.classList.add("open");
        card.classList.add("menu-open");
      }
    });
  });

  document.querySelectorAll(".kebab-item.view").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("button").dataset.id;
      const task = allTasksCache.find((t) => t._id === id);
      if (task) openDrawerForView(task);
      closeAllKebabs();
    });
  });

  document.querySelectorAll(".kebab-item.edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("button").dataset.id;
      const task = allTasksCache.find((t) => t._id === id);
      if (task) openDrawerForEdit(task);
      closeAllKebabs();
    });
  });

  document.querySelectorAll(".kebab-item.delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("button").dataset.id;
      closeAllKebabs();
      openDeleteModal(id);
    });
  });
}

function closeAllKebabs() {
  document.querySelectorAll(".kebab-dropdown.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".task-card.menu-open").forEach((c) => c.classList.remove("menu-open"));
}

document.addEventListener("click", closeAllKebabs);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---- Create OR update task (same form, same submit handler) ----
document.getElementById("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("task-error");
  errorEl.textContent = "";

  const taskId = document.getElementById("task-id").value;
  const title = titleInput.value;
  const description = descInput.value;
  const deadline = deadlineInput.value;
  const workspace = workspaceInput.value;
  const priority = priorityInput.value;

  const isEditing = Boolean(taskId);

  const res = await apiFetch(isEditing ? `/tasks/${taskId}` : "/tasks", {
    method: isEditing ? "PUT" : "POST",
    body: JSON.stringify({ title, description, deadline: deadline || null, workspace, priority }),
  });

  if (!res) return;

  if (!res.ok) {
    const data = await res.json();
    errorEl.textContent = data.msg || "Could not save task";
    return;
  }

  document.getElementById("task-form").reset();
  closeDrawer();
  loadTasks();
  if (fullCalendarInstance) refreshCalendarEvents();
});

// ---- Search & filter ----
document.getElementById("search-input").addEventListener("input", debounce(loadTasks, 300));
document.getElementById("status-filter").addEventListener("change", loadTasks);
document.getElementById("priority-filter").addEventListener("change", loadTasks);

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ============================================================
// CALENDAR POPUP
// ============================================================
const calendarModal = document.getElementById("calendar-modal");
let fullCalendarInstance = null;

function statusColor(status) {
  if (status === "completed") return "#7ee787";
  if (status === "in-progress") return "#4ecdc4";
  return "#f0a868";
}

function buildCalendarEvents() {
  return allTasksCache
    .filter((t) => t.deadline)
    .map((t) => ({
      id: t._id,
      title: t.title,
      start: new Date(t.deadline).toISOString().split("T")[0],
      allDay: true,
      backgroundColor: statusColor(t.status),
      borderColor: statusColor(t.status),
      textColor: "#1a1625",
    }));
}

function refreshCalendarEvents() {
  if (!fullCalendarInstance) return;
  fullCalendarInstance.removeAllEvents();
  fullCalendarInstance.addEventSource(buildCalendarEvents());
}

function renderDayTasks(dateStr) {
  const panelTitle = document.getElementById("calendar-day-title");
  const panelList = document.getElementById("calendar-day-tasks");

  const dateObj = new Date(dateStr + "T00:00:00");
  panelTitle.textContent = dateObj.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tasksOnDay = allTasksCache.filter((t) => {
    if (!t.deadline) return false;
    return new Date(t.deadline).toISOString().split("T")[0] === dateStr;
  });

  if (tasksOnDay.length === 0) {
    panelList.innerHTML = `<p class="notif-empty">No tasks due on this date.</p>`;
    return;
  }

  panelList.innerHTML = tasksOnDay
    .map(
      (t) => `
      <div class="calendar-day-task">
        <span class="badge ${t.status}">${t.status.replace("-", " ")}</span>
        <span class="calendar-day-task-title">${escapeHtml(t.title)}</span>
      </div>
    `
    )
    .join("");
}

function initCalendarIfNeeded() {
  if (fullCalendarInstance) return;

  const calendarEl = document.getElementById("dashboard-calendar");
  fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: 340,
    contentHeight: 300,
    dayMaxEvents: 2,
    eventDisplay: "list-item",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "",
    },
    events: buildCalendarEvents(),
    dateClick: (info) => {
      document.querySelectorAll(".fc-daygrid-day.calendar-selected-day").forEach((el) =>
        el.classList.remove("calendar-selected-day")
      );
      info.dayEl.classList.add("calendar-selected-day");
      renderDayTasks(info.dateStr);
    },
  });

  fullCalendarInstance.render();

  // Default to showing today's tasks
  const todayStr = new Date().toISOString().split("T")[0];
  renderDayTasks(todayStr);
}

function openCalendarModal() {
  calendarModal.classList.add("open");
  initCalendarIfNeeded();
  refreshCalendarEvents();
  setTimeout(() => fullCalendarInstance && fullCalendarInstance.updateSize(), 50);
}

function closeCalendarModal() {
  calendarModal.classList.remove("open");
}

document.getElementById("calendar-view-btn").addEventListener("click", openCalendarModal);
document.getElementById("close-calendar-btn").addEventListener("click", closeCalendarModal);

calendarModal.addEventListener("click", (e) => {
  if (e.target.id === "calendar-modal") closeCalendarModal();
});

// ---- Initial load ----
loadTasks();
const dateEl = document.getElementById("current-date");
if (dateEl) {
  const today = new Date();
  dateEl.textContent = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}