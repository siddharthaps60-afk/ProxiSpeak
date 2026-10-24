const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // Active Socket.IO connection
    socketId: {
      type: String,
      default: null,
    },

    // Existing auth branch position
    position: {
      x: {
        type: Number,
        default: 0,
      },
      y: {
        type: Number,
        default: 0,
      },
    },

    // Week 2 proximity feature
    location: {
      type: [Number],
      default: [0, 0],
    },
  },
  {
    timestamps: true,
  }
);

// Required for MongoDB proximity queries
userSchema.index(
  { location: "2d" },
  { min: 0, max: 10000 }
);

module.exports = mongoose.model("User", userSchema);