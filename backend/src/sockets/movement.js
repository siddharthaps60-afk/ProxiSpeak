
const User = require("../models/user.model");

module.exports.registerMovementHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("player:move", async (data) => {
      const { x, y } = data || {};

      // Validate coordinates
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
        await User.findOneAndUpdate(
          { socketId: socket.id },
          {
            $set: {
              location: [x, y],
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
          }
        );
      } catch (err) {
        console.error("Error updating user position:", err);
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
        await User.findOneAndDelete({ socketId: socket.id });
        console.log(
          `User ${socket.id} disconnected and removed from database`
        );
      } catch (err) {
        console.error("Error removing user from database:", err);
      }

      // Notify other connected players
      socket.broadcast.emit("player:left", {
        socketId: socket.id,
      });
    });
  });
};
