
const User = require("../models/user.model");
const { getNearbyUsers } = require("../services/proximityService");

const MAX_DISTANCE = 100;

module.exports.registerWebRTCHandlers = (io) => {
  io.on("connection", (socket) => {
    // Send an offer or answer only to a connected nearby recipient.
    const relaySignal = async (eventName, data, expectedType) => {
      try {
        const { recipientSocketId, sdp } = data || {};

        if (
          typeof recipientSocketId !== "string" ||
          !recipientSocketId.trim() ||
          recipientSocketId === socket.id
        ) {
          return socket.emit("webrtc:error", {
            code: "INVALID_RECIPIENT",
            message: "A valid recipientSocketId is required.",
          });
        }

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

        // Get the sender's position from the database, not client input.
        const sender = await User.findOne({
          socketId: socket.id,
        }).select("socketId location").lean();

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

        // Confirm the recipient is within the allowed radius.
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

        // Socket.IO IDs are also private rooms.
        const recipientIsConnected =
          io.sockets.sockets.has(recipientSocketId);

        if (!recipientIsConnected) {
          return socket.emit("webrtc:error", {
            code: "RECIPIENT_DISCONNECTED",
            message: "The recipient is no longer connected.",
          });
        }

        // Never trust a sender ID supplied by the client.
        io.to(recipientSocketId).emit(eventName, {
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
