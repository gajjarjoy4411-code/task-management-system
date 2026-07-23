const Task = require("../models/Task");
const sendTaskEmail = require("./sendEmail");
const createNotification = require("./createNotification");

// Helper: start/end of a given day, offset from today by `dayOffset` days
function dayRange(dayOffset) {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function daysOverdue(deadline) {
  const diffMs = new Date().setHours(0, 0, 0, 0) - new Date(deadline).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

async function processReminder({
  start,
  end,
  comparison,
  flagField,
  notifType,
  message,
  userId,
  mode = "once", // "once" = fire a single time ever, "daily" = fire again once per day until resolved
}) {
  const deadlineFilter =
    comparison === "before"
      ? { $lt: start } // deadline is before today (overdue)
      : { $gte: start, $lte: end }; // deadline falls on this exact day

  const filter = {
    deadline: deadlineFilter,
    status: { $ne: "completed" },
  };

  if (userId) {
    filter.user = userId;
  }

  if (mode === "once") {
    filter[flagField] = false;
  } else {
    // daily mode — only notify again if we haven't already today
    filter.$or = [{ [flagField]: null }, { [flagField]: { $lt: start } }];
  }

  const tasks = await Task.find(filter).populate("user", "email name");

  for (const task of tasks) {
    if (!task.user?.email) continue;

    try {
      await sendTaskEmail(task.user.email, task.title, task.deadline, notifType);
    } catch (emailErr) {
      console.error(`Could not email ${task.user.email}:`, emailErr.message);
    }

    await createNotification({
      userId: task.user._id,
      taskId: task._id,
      type: notifType,
      message: message(task),
    });

    task[flagField] = mode === "once" ? true : new Date();
    await task.save();

    console.log(`✅ [${notifType}] processed for ${task.user.email} - "${task.title}"`);
  }
}

// Runs all 3 reminder checks. Pass a userId to scope it to just that
// person (used when they open the app) — omit it to check everyone
// (used by the daily background job as a safety net).
async function runReminderChecks(userId = null) {
  const tomorrow = dayRange(1);
  const today = dayRange(0);

  // 1) Due tomorrow — fires once
  await processReminder({
    start: tomorrow.start,
    end: tomorrow.end,
    comparison: "on",
    flagField: "reminderSent",
    notifType: "due_soon",
    message: (task) => `"${task.title}" is due tomorrow — get ready!`,
    userId,
    mode: "once",
  });

  // 2) Due today — fires once
  await processReminder({
    start: today.start,
    end: today.end,
    comparison: "on",
    flagField: "dueTodayReminderSent",
    notifType: "due_today",
    message: (task) => `"${task.title}" is due today — last chance to complete it!`,
    userId,
    mode: "once",
  });

  // 3) Overdue — fires again every day until the task is completed
  await processReminder({
    start: today.start,
    comparison: "before",
    flagField: "overdueLastNotified",
    notifType: "overdue",
    message: (task) =>
      `"${task.title}" is overdue by ${daysOverdue(task.deadline)} day${
        daysOverdue(task.deadline) > 1 ? "s" : ""
      } and still not completed.`,
    userId,
    mode: "daily",
  });
}

module.exports = runReminderChecks;
