
const express = require("express");
const mongoose = require("mongoose");
const Room = require("../models/room.model");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Require authentication for all room APIs
router.use(authenticateToken);

// POST /api/rooms - Create a room
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (
      typeof name !== "string" ||
      name.trim().length < 3 ||
      name.trim().length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Room name must be between 3 and 50 characters",
      });
    }

    if (
      description !== undefined &&
      (typeof description !== "string" || description.trim().length > 250)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string of at most 250 characters",
      });
    }

    const room = await Room.create({
      name: name.trim(),
      description: description?.trim() || "",
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    console.error("Create room error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create room",
    });
  }
});

// GET /api/rooms - Get all rooms
router.get("/", async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: rooms.length,
      rooms,
    });
  } catch (error) {
    console.error("Get rooms error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve rooms",
    });
  }
});

// GET /api/rooms/:id - Get one room
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    const room = await Room.findById(req.params.id)
      .populate("createdBy", "name email");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    return res.status(200).json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("Get room error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve room",
    });
  }
});

// PUT /api/rooms/:id - Update a room
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid room ID",
      });
    }

    const { name, description, isActive } = req.body;

    if (
      name === undefined &&
      description === undefined &&
      isActive === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one field is required for update",
      });
    }

    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        name.trim().length < 3 ||
        name.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "Room name must be between 3 and 50 characters",
        });
      }

      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (
        typeof description !== "string" ||
        description.trim().length > 250
      ) {
        return res.status(400).json({
          success: false,
          message: "Description must be a string of at most 250 characters",
        });
      }

      updates.description = description.trim();
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean",
        });
      }

      updates.isActive = isActive;
    }

    const room = await Room.findOneAndUpdate(
      {
        _id: req.params.id,
        createdBy: req.user._id,
      },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("createdBy", "name email");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found or you are not its owner",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      room,
    });
  } catch (error) {
    console.error("Update room error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update room",
    });
  }
});

module.exports = router;
