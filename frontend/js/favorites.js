let allTasksCache = [];
const emptyMsg = document.getElementById("empty-msg");

async function loadFavoriteTasks() {
  const res = await apiFetch("/tasks");
  if (!res) return;
  const tasks = await res.json();

  allTasksCache = tasks.filter((t) => t.starred);
  renderFavoriteTasks(allTasksCache);
}

function renderFavoriteTasks(tasks) {
  const list = document.getElementById("task-list");
  list.innerHTML = "";

  if (tasks.length === 0) {
    emptyMsg.textContent = "No favorite tasks yet. Star a task to see it here.";
    list.appendChild(emptyMsg);
    emptyMsg.style.display = "block";
    return;
  }

  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = `task-card ${task.status === "completed" ? "completed" : ""}`;

    const priorityFlags = { high: "🚩", medium: "🚩", low: "🚩" };
    const priorityText = { high: "High", medium: "Medium", low: "Low" };
    const priorityHtml = task.priority
      ? `<span class="meta-priority priority-${task.priority}">${priorityFlags[task.priority]} ${priorityText[task.priority] || task.priority}</span>`
      : `<span class="meta-priority"></span>`;

    const workspaceHtml = task.workspace
      ? `<span class="meta-workspace">${task.workspace}</span>`
      : `<span class="meta-workspace"></span>`;

    const deadlineHtml = task.deadline
      ? `<span class="meta-date">📅 ${new Date(task.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>`
      : `<span class="meta-date"></span>`;

    card.innerHTML = `
      <div class="task-info">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ""}
        <div class="task-meta">
          <span class="badge ${task.status}">${task.status.replace("-", " ")}</span>
          ${priorityHtml}
          ${workspaceHtml}
          ${deadlineHtml}
        </div>
      </div>
      <div class="task-actions">
        <button class="star-btn starred" data-id="${task._id}" title="Unstar this task">⭐</button>
      </div>
    `;

    list.appendChild(card);
  });

  attachFavoriteListeners();
}

function attachFavoriteListeners() {
  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;

      await apiFetch(`/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ starred: false }),
      });
      loadFavoriteTasks();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadFavoriteTasks();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadFavoriteTasks();
});