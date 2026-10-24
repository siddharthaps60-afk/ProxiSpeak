
const Player = require("../models/player.model");
const { getNearbyUsers } = require("../services/proximityService");
const { getSocketId, getUserId } = require("./socketUserMapping");

const MAX_DISTANCE = 100;

module.exports.registerWebRTCHandlers = (io) => {
  io.on("connection", (socket) => {
    const relaySignal = async (eventName, data, expectedType) => {
      try {
        // Step 6: Require the sender to register before signaling.
        const senderUserId = getUserId(socket.id);

        if (!senderUserId) {
          return socket.emit("webrtc:error", {
            code: "SENDER_NOT_REGISTERED",
            message: "Register your userId before sending WebRTC signals.",
          });
        }

        // Read and validate the recipient's stable user ID.
        const { sdp } = data || {};
        const recipientUserId =
          typeof data?.recipientUserId === "string"
            ? data.recipientUserId.trim()
            : "";

        if (
          !recipientUserId ||
          recipientUserId.length > 100
        ) {
          return socket.emit("webrtc:error", {
            code: "INVALID_RECIPIENT",
            message: "A valid recipientUserId is required.",
          });
        }

        // Prevent sending a signal to yourself.
        if (recipientUserId === senderUserId) {
          return socket.emit("webrtc:error", {
            code: "INVALID_RECIPIENT",
            message: "You cannot send a signal to yourself.",
          });
        }

        // Validate the SDP offer or answer.
        if (
          !sdp ||
          typeof sdp !== "object" ||
          sdp.type !== expectedType ||
          typeof sdp.sdp !== "string" ||
          !sdp.sdp.trim() ||
          sdp.sdp.length > 100000
        ) {
          return socket.emit("webrtc:error", {
            code: "INVALID_SDP",
            message: `A valid ${expectedType} SDP is required.`,
          });
        }

        // Resolve the recipient's user ID to their active socket.
        const recipientSocketId = getSocketId(recipientUserId);

        if (
          !recipientSocketId ||
          !io.sockets.sockets.has(recipientSocketId)
        ) {
          return socket.emit("webrtc:error", {
            code: "RECIPIENT_DISCONNECTED",
            message: "The recipient is not registered or is disconnected.",
          });
        }

        // Find the sender's saved position in MongoDB.
       const sender = await Player.findOne({
  socketId: socket.id,
})
  .select("socketId location")
  .lean();

        if (
          !sender ||
          !Array.isArray(sender.location) ||
          sender.location.length !== 2 ||
          !sender.location.every(Number.isFinite)
        ) {
          return socket.emit("webrtc:error", {
            code: "SENDER_POSITION_NOT_FOUND",
            message: "Move to register your position before signaling.",
          });
        }

        // Find users within the allowed proximity distance.
        const nearbyUsers = await getNearbyUsers({
          x: sender.location[0],
          y: sender.location[1],
          radius: MAX_DISTANCE,
          excludeSocketId: socket.id,
        });

        const recipientIsNearby = nearbyUsers.some(
          (user) => user.socketId === recipientSocketId
        );

        if (!recipientIsNearby) {
          return socket.emit("webrtc:error", {
            code: "RECIPIENT_NOT_NEARBY",
            message: "The recipient is not within the allowed distance.",
          });
        }

        // Relay the signal only to the nearby recipient.
        io.to(recipientSocketId).emit(eventName, {
          senderUserId,
          senderSocketId: socket.id,
          sdp,
        });
      } catch (error) {
        console.error(`Error relaying ${eventName}:`, error);

        socket.emit("webrtc:error", {
          code: "SIGNALING_FAILED",
          message: "Unable to relay the WebRTC signal.",
        });
      }
    };

    socket.on("webrtc:offer", (data) => {
      relaySignal("webrtc:offer", data, "offer");
    });

    socket.on("webrtc:answer", (data) => {
      relaySignal("webrtc:answer", data, "answer");
    });
  });
};
