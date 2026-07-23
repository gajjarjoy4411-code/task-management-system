const Notification = require("../models/Notification");

const createNotification = async ({ userId, taskId = null, type, message }) => {
  try {
    await Notification.create({
      user: userId,
      task: taskId,
      type,
      message,
    });
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
};

module.exports = createNotification;
