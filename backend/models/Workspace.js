const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: "⚪",
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// A user can't have two workspaces with the same name
workspaceSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Workspace", workspaceSchema);
