const express = require("express");
const Workspace = require("../models/Workspace");
const Task = require("../models/Task");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

const DEFAULT_WORKSPACES = [

];

// @route   GET /api/workspaces
// @desc    Get the logged-in user's workspaces (seeds the 4 defaults the first time)
router.get("/", async (req, res, next) => {
  try {
    let workspaces = await Workspace.find({ user: req.user.id }).sort({ createdAt: 1 });

    if (workspaces.length === 0) {
      const seeded = DEFAULT_WORKSPACES.map((w) => ({ ...w, user: req.user.id }));
      workspaces = await Workspace.insertMany(seeded);
    }

    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/workspaces
// @desc    Create a new custom workspace
router.post("/", async (req, res, next) => {
  try {
    const { name, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ msg: "Workspace name is required" });
    }

    const existing = await Workspace.findOne({ user: req.user.id, name: name.trim() });
    if (existing) {
      return res.status(400).json({ msg: "You already have a workspace with that name" });
    }

    const workspace = await Workspace.create({
      user: req.user.id,
      name: name.trim(),
      icon: icon || "⚪",
    });

    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/workspaces/:id
// @desc    Delete a workspace. Any tasks in it are moved to "Personal" first.
router.delete("/:id", async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace) return res.status(404).json({ msg: "Workspace not found" });
    if (workspace.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not allowed" });
    }
    if (workspace.name === "Personal") {
      return res.status(400).json({ msg: "The Personal workspace can't be deleted" });
    }

    // Move any tasks out of this workspace before deleting it
    await Task.updateMany(
      { user: req.user.id, workspace: workspace.name },
      { $set: { workspace: "Personal" } }
    );

    await workspace.deleteOne();

    res.json({ msg: "Workspace deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
