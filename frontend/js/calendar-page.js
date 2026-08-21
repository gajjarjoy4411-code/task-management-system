let allCalendarTasks = [];
let fullCalendarInstance = null;

function statusColor(status) {
  if (status === "completed") return "#7ee787";
  if (status === "in-progress") return "#4ecdc4";
  return "#f0a868";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function buildCalendarEvents() {
  return allCalendarTasks
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

  const tasksOnDay = allCalendarTasks.filter((t) => {
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

async function loadCalendarTasks() {
  const res = await apiFetch("/tasks");
  if (!res) return;
  allCalendarTasks = await res.json();

  if (!fullCalendarInstance) {
    const calendarEl = document.getElementById("full-calendar");
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "auto",
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,dayGridWeek",
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
  } else {
    fullCalendarInstance.removeAllEvents();
    fullCalendarInstance.addEventSource(buildCalendarEvents());
  }

  const todayStr = new Date().toISOString().split("T")[0];
  renderDayTasks(todayStr);
}

loadCalendarTasks();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) loadCalendarTasks();
});