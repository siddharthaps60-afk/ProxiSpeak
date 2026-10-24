
const Player = require("../models/player.model");

module.exports.registerMovementHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("player:move", async (data) => {
      const { x, y } = data || {};

      // Validate coordinates.
      if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        x > 10000 ||
        y < 0 ||
        y > 10000
      ) {
        return;
      }

      try {
        await Player.findOneAndUpdate(
          { socketId: socket.id },
          { $set: { location: [x, y] } },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
          }
        );
      } catch (err) {
        console.error("Error updating player position:", err);
        return;
      }

      socket.broadcast.emit("player:moved", {
        socketId: socket.id,
        location: { x, y },
      });

      console.log(`Player ${socket.id} moved to (${x}, ${y})`);
    });

    socket.on("disconnect", async () => {
      try {
        await Player.findOneAndDelete({ socketId: socket.id });
        console.log(`Player ${socket.id} removed from database`);
      } catch (err) {
        console.error("Error removing player from database:", err);
      }

      socket.broadcast.emit("player:left", {
        socketId: socket.id,
      });
    });
  });
};
