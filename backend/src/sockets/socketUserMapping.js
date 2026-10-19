
const userSockets = new Map();
const socketUsers = new Map();

module.exports.registerSocketUserMapping = (io) => {
  io.on("connection", (socket) => {
    socket.on("user:register", (data) => {
      const userId =
        typeof data?.userId === "string"
          ? data.userId.trim()
          : "";

      if (!userId || userId.length > 100) {
        socket.emit("user:error", {
          code: "INVALID_USER_ID",
          message: "A valid userId is required.",
        });
        return;
      }

      const existingSocketId = userSockets.get(userId);

      if (
        existingSocketId &&
        existingSocketId !== socket.id
      ) {
        socket.emit("user:error", {
          code: "USER_ALREADY_REGISTERED",
          message: "This user is already connected.",
        });
        return;
      }

      // Remove an older mapping if this socket registers again.
      const previousUserId = socketUsers.get(socket.id);

      if (previousUserId && previousUserId !== userId) {
        userSockets.delete(previousUserId);
      }

      userSockets.set(userId, socket.id);
      socketUsers.set(socket.id, userId);

      socket.emit("user:registered", {
        userId,
        socketId: socket.id,
      });
    });

    socket.on("disconnect", () => {
      const userId = socketUsers.get(socket.id);

      if (userId && userSockets.get(userId) === socket.id) {
        userSockets.delete(userId);
      }

      socketUsers.delete(socket.id);
    });
  });
};

module.exports.getSocketId = (userId) =>
  userSockets.get(userId) || null;

module.exports.getUserId = (socketId) =>
  socketUsers.get(socketId) || null;
