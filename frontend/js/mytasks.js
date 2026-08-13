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
  loadAllTasks();
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
  if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
});

// ---- Workspace filtering is handled by common.js (tabs, +, delete) ----
// This page just needs to refresh its task list when the filter changes:
window.onWorkspaceFilterChange = () => loadAllTasks();
window.onWorkspacesLoaded = () => loadAllTasks();

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
  loadAllTasks();
});

// ---- Load / render tasks ----
let allTasksCache = [];

async function loadAllTasks() {
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

  const hasActiveFilters = Boolean(search || status || priority || currentWorkspaceFilter);

  allTasksCache = sortByPriority(tasks);
  renderAllTasks(allTasksCache, hasActiveFilters);
}

function sortByPriority(tasks) {
  const order = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    // Starred tasks always float to the top, regardless of priority
    if (a.starred !== b.starred) return a.starred ? -1 : 1;
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
  });
}
function renderAllTasks(tasks, hasActiveFilters = false) {
  const list = document.getElementById("task-list");
  const emptyMsg = document.getElementById("empty-msg");

  list.innerHTML = "";

  if (tasks.length === 0) {
    emptyMsg.textContent = hasActiveFilters
      ? "Task not found."
      : "No tasks yet.";
    list.appendChild(emptyMsg);
    emptyMsg.style.display = "block";
    return;
  }

  const workspaceIcons = {};
userWorkspaces.forEach((w) => {
  workspaceIcons[w.name] = w.icon;
});
  const priorityLabels = { high: "🔴 High", medium: "🟡 Medium", low: "🟢 Low" };

  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.innerHTML = 
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
      loadAllTasks();
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

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

document.getElementById("status-filter").addEventListener("change", loadAllTasks);
document.getElementById("priority-filter").addEventListener("change", loadAllTasks);
document.getElementById("search-input").addEventListener("input", debounce(loadAllTasks, 300));

loadAllTasks();
