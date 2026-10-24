const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    socketId: {
      type: String,
      required: true,
      unique: true,
    },
    location: {
      type: [Number],
      default: [0, 0],
    },
  },
  { timestamps: true }
);

playerSchema.index({ location: "2d" }, { min: 0, max: 10000 });

module.exports = mongoose.model("Player", playerSchema);
