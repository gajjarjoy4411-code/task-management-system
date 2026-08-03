const express = require("express");
const Task = require("../models/Task");
const protect = require("../middleware/authMiddleware");
const createNotification = require("../utils/createNotification");

const router = express.Router();

router.use(protect);

// @route   GET /api/tasks
router.get("/", async (req, res, next) => {
  try {
    const filter = { user: req.user.id };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.workspace) {
      filter.workspace = req.query.workspace;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (req.query.search) {
      filter.title = { $regex: req.query.search, $options: "i" };
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/tasks/stats/summary
// NOTE: this route must come BEFORE /:id, or "stats" gets treated as an id
router.get("/stats/summary", async (req, res, next) => {
  try {
    const tasks = await Task.find({ user: req.user.id });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const createdThisWeek = tasks.filter((t) => new Date(t.createdAt) >= sevenDaysAgo);

    const summary = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      totalNewThisWeek: createdThisWeek.length,
      pendingNewThisWeek: createdThisWeek.filter((t) => t.status === "pending").length,
      inProgressNewThisWeek: createdThisWeek.filter((t) => t.status === "in-progress").length,
      completedNewThisWeek: createdThisWeek.filter((t) => t.status === "completed").length,
    };

    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/tasks/:id
router.get("/:id", async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not allowed" });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/tasks
router.post("/", async (req, res, next) => {
  try {
    const { title, description, status, deadline, workspace, priority } = req.body;

    if (!title) {
      return res.status(400).json({ msg: "Title is required" });
    }

    const task = await Task.create({
      title,
      description,
      status,
      deadline,
      workspace,
      priority,
      user: req.user.id,
    });

    await createNotification({
      userId: req.user.id,
      taskId: task._id,
      type: "created",
      message: `You created a new task: "${task.title}"`,
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/tasks/:id
router.put("/:id", async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not allowed" });
    }

    const wasCompleted = task.status === "completed";

    task.title = req.body.title ?? task.title;
    task.description = req.body.description ?? task.description;
    task.status = req.body.status ?? task.status;
    task.deadline = req.body.deadline ?? task.deadline;
    task.workspace = req.body.workspace ?? task.workspace;
    task.priority = req.body.priority ?? task.priority;

    const updatedTask = await task.save();

    if (!wasCompleted && updatedTask.status === "completed") {
      await createNotification({
        userId: req.user.id,
        taskId: updatedTask._id,
        type: "completed",
        message: `You completed the task: "${updatedTask.title}" 🎉`,
      });
    }

    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/tasks/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ msg: "Task not found" });

    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not allowed" });
    }

    await task.deleteOne();
    res.json({ msg: "Task deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;