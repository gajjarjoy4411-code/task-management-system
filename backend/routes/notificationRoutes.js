const express = require("express");
const Notification = require("../models/Notification");
const protect = require("../middleware/authMiddleware");
const runReminderChecks = require("../utils/reminderCheck");

const router = express.Router();

router.use(protect);

// @route   GET /api/notifications
// @desc    Get the logged-in user's notifications (most recent first).
//          Also checks their tasks for any due-date reminders that need
//          to fire right now — this is what makes reminders show up the
//          moment someone opens the app, at any time of day, not just
//          whenever the background job happens to run.
router.get("/", async (req, res, next) => {
  try {
    try {
      await runReminderChecks(req.user.id);
    } catch (reminderErr) {
      // Don't let a reminder-check hiccup block the person from seeing
      // their existing notifications
      console.error("Reminder check failed:", reminderErr.message);
    }

    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/notifications/:id/read
router.put("/:id/read", async (req, res, next) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ msg: "Not found" });
    if (notif.user.toString() !== req.user.id)
      return res.status(401).json({ msg: "Not allowed" });

    notif.read = true;
    await notif.save();
    res.json(notif);
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/notifications/read-all
router.put("/read-all", async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: "All marked as read" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
