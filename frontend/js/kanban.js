// auth guard, apiFetch, logout, profile menu are all set up by common.js

let kanbanTasks = [];
let currentViewedTaskId = null;

// ---- Drawer (view/edit/new) ----
const drawer = document.getElementById("add-task-drawer");
const drawerTitle = document.getElementById("drawer-title");
const submitBtn = document.getElementById("task-submit-btn");

const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-description");
const deadlineInput = document.getElementById("task-deadline");
const workspaceInput = document.getElementById("task-workspace");
const priorityInput = document.getElementById("task-priority");

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

function openDrawerForNewTask(status) {
  document.getElementById("task-form").reset();
  document.getElementById("task-id").value = "";
  currentViewedTaskId = null;
  drawer.dataset.newStatus = status || "pending";
  setPriority("medium");
  drawerTitle.textContent = "New Task";
  submitBtn.textContent = "+ Add Task";
  document.querySelector(".kebab-menu").style.display = "none";
  setFieldsDisabled(false);

  drawer.classList.add("open");
  titleInput.focus();
  setupAutoGrowTextarea("task-description");
}

function openDrawerForView(task) {
  currentViewedTaskId = task._id;
  delete drawer.dataset.newStatus;
  fillFormWith(task);
  drawerTitle.textContent = "View Task";
  document.querySelector(".kebab-menu").style.display = "block";
  setFieldsDisabled(true);

  drawer.classList.add("open");
  setupAutoGrowTextarea("task-description");
}

function openDrawerForEdit(task) {
  currentViewedTaskId = task._id;
  delete drawer.dataset.newStatus;
  fillFormWith(task);
  drawerTitle.textContent = "Edit Task";
  submitBtn.textContent = "Save Changes";
  document.querySelector(".kebab-menu").style.display = "block";
  setFieldsDisabled(false);

  drawer.classList.add("open");
  setupAutoGrowTextarea("task-description");
}

function closeDrawer() {
  drawer.classList.remove("open");
  document.getElementById("task-error").textContent = "";
  setFieldsDisabled(false);
  currentViewedTaskId = null;
}

document.getElementById("close-drawer-btn").addEventListener("click", closeDrawer);

document.getElementById("kanban-add-task-btn").addEventListener("click", () => openDrawerForNewTask("pending"));

document.querySelectorAll(".kanban-col-add").forEach((btn) => {
  btn.addEventListener("click", () => openDrawerForNewTask(btn.dataset.status));
});

drawer.addEventListener("click", (e) => {
  if (e.target.id === "add-task-drawer") closeDrawer();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
});

// ---- Kebab menu inside the drawer itself (Edit / Delete, while viewing) ----
const taskKebabBtn = document.getElementById("task-kebab-btn");
const taskKebabDropdown = document.getElementById("task-kebab-dropdown");

taskKebabBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  taskKebabDropdown.classList.toggle("open");
});

document.getElementById("drawer-edit-btn").addEventListener("click", () => {
  taskKebabDropdown.classList.remove("open");
  const task = kanbanTasks.find((t) => t._id === currentViewedTaskId);
  if (task) openDrawerForEdit(task);
});

// ---- Delete confirmation (shared by drawer kebab AND card kebab) ----
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

document.getElementById("drawer-delete-btn").addEventListener("click", () => {
  taskKebabDropdown.classList.remove("open");
  openDeleteModal(currentViewedTaskId);
});

document.getElementById("cancel-delete-btn").addEventListener("click", closeDeleteModal);

deleteModal.addEventListener("click", (e) => {
  if (e.target.id === "delete-modal") closeDeleteModal();
});

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  await apiFetch(`/tasks/${pendingDeleteId}`, { method: "DELETE" });
  closeDeleteModal();
  closeDrawer();
  loadKanbanTasks();
});

// ---- Create OR update (same form) ----
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
  const body = { title, description, deadline: deadline || null, workspace, priority };

  if (!isEditing) {
    body.status = drawer.dataset.newStatus || "pending";
  }

  const res = await apiFetch(isEditing ? `/tasks/${taskId}` : "/tasks", {
    method: isEditing ? "PUT" : "POST",
    body: JSON.stringify(body),
  });

  if (!res) return;

  if (!res.ok) {
    const data = await res.json();
    errorEl.textContent = data.msg || "Could not save task";
    return;
  }

  closeDrawer();
  loadKanbanTasks();
});

// ---- Load / render board ----
async function loadKanbanTasks() {
  const res = await apiFetch("/tasks");
  if (!res) return;
  kanbanTasks = await res.json();
  renderKanban();
}

function renderKanban() {
  const columns = {
    pending: document.getElementById("col-pending"),
    "in-progress": document.getElementById("col-in-progress"),
    completed: document.getElementById("col-completed"),
  };

  Object.values(columns).forEach((col) => (col.innerHTML = ""));

  const counts = { pending: 0, "in-progress": 0, completed: 0 };
  const priorityColors = { high: "#ef4444", medium: "#eab308", low: "#22c55e" };
  const priorityText = { high: "High", medium: "Medium", low: "Low" };
  const priorityEmoji = { high: "🔥", medium: "⚡", low: "🌿" };

  kanbanTasks.forEach((task) => {
    counts[task.status] = (counts[task.status] || 0) + 1;

    const card = document.createElement("div");
    card.className = "kanban-card";
    card.draggable = true;
    card.dataset.id = task._id;
    card.style.borderLeftColor = priorityColors[task.priority] || "var(--card-border)";

    card.innerHTML = `
      <div class="kanban-card-top">
        <p class="kanban-card-title">📝 ${escapeHtml(task.title)}</p>
        <div class="kanban-card-kebab-menu">
          <button class="kanban-card-kebab" data-id="${task._id}" title="More actions">⋯</button>
          <div class="kebab-dropdown" id="kanban-kebab-${task._id}">
            <button class="kebab-item kanban-view-btn" data-id="${task._id}">👁️ View</button>
            <button class="kebab-item kanban-edit-btn" data-id="${task._id}">✏️ Edit</button>
            <button class="kebab-item delete kanban-delete-btn" data-id="${task._id}">🗑️ Delete</button>
          </div>
        </div>
      </div>
      ${
        task.priority
          ? `<span class="kanban-priority-pill priority-${task.priority}">${priorityEmoji[task.priority] || ""} ${priorityText[task.priority] || task.priority} Priority</span>`
          : ""
      }
      ${task.deadline ? `<span class="kanban-card-date">📅 ${new Date(task.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>` : `<span class="kanban-card-date">No due date</span>`}
    `;

    let dragged = false;

    card.addEventListener("dragstart", (e) => {
      dragged = true;
      e.dataTransfer.setData("text/plain", task._id);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => card.classList.remove("dragging"));

    card.addEventListener("click", (e) => {
      if (e.target.closest(".kanban-card-kebab-menu")) return; // let kebab clicks handle themselves
      if (dragged) {
        dragged = false;
        return;
      }
      openDrawerForView(task);
    });

    columns[task.status]?.appendChild(card);
  });

  document.getElementById("count-pending").textContent = counts.pending;
  document.getElementById("count-in-progress").textContent = counts["in-progress"];
  document.getElementById("count-completed").textContent = counts.completed;

  attachCardKebabListeners();
}

function attachCardKebabListeners() {
  document.querySelectorAll(".kanban-card-kebab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById(`kanban-kebab-${btn.dataset.id}`);
      const card = btn.closest(".kanban-card");
      const wasOpen = dropdown.classList.contains("open");
      closeAllCardKebabs();
      if (!wasOpen) {
        dropdown.classList.add("open");
        card.classList.add("menu-open");
      }
    });
  });

  document.querySelectorAll(".kanban-view-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllCardKebabs();
      const task = kanbanTasks.find((t) => t._id === btn.dataset.id);
      if (task) openDrawerForView(task);
    });
  });

  document.querySelectorAll(".kanban-edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllCardKebabs();
      const task = kanbanTasks.find((t) => t._id === btn.dataset.id);
      if (task) openDrawerForEdit(task);
    });
  });

  document.querySelectorAll(".kanban-delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllCardKebabs();
      openDeleteModal(btn.dataset.id);
    });
  });
}

function closeAllCardKebabs() {
  document.querySelectorAll(".kanban-card-kebab-menu .kebab-dropdown.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".kanban-card.menu-open").forEach((c) => c.classList.remove("menu-open"));
}

document.addEventListener("click", closeAllCardKebabs);

document.querySelectorAll(".kanban-cards").forEach((zone) => {
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));

  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");

    const taskId = e.dataTransfer.getData("text/plain");
    const newStatus = zone.closest(".kanban-column").dataset.status;

    const task = kanbanTasks.find((t) => t._id === taskId);
    if (!task || task.status === newStatus) return;

    task.status = newStatus;
    renderKanban();

    await apiFetch(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
  });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadKanbanTasks();