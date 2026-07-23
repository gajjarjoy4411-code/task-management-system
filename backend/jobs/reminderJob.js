const cron = require("node-cron");
const runReminderChecks = require("../utils/reminderCheck");

const startReminderJob = () => {
  // Safety net only — most reminders now fire the moment a person opens
  // the app (see notificationRoutes.js). This daily run catches anyone
  // who doesn't open the app that day, so their email reminder still goes out.
  cron.schedule("0 8 * * *", async () => {
    console.log("⏰ Running daily background reminder check (safety net)...");
    try {
      await runReminderChecks(); // no userId = check every user's tasks
      console.log("⏰ Daily reminder check complete.");
    } catch (err) {
      console.error("❌ Reminder job failed:", err.message);
    }
  });
};

module.exports = startReminderJob;
