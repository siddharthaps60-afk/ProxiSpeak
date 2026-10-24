
const Player = require("../models/player.model");

module.exports.getNearbyUsers = async ({
  x,
  y,
  radius = 100,
  excludeSocketId = null,
}) => {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(radius) ||
    x < 0 ||
    x > 10000 ||
    y < 0 ||
    y > 10000 ||
    radius <= 0
  ) {
    throw new Error("Invalid coordinates or radius");
  }

  const query = {
    location: {
      $near: [x, y],
      $maxDistance: radius,
    },
  };

  if (excludeSocketId) {
    query.socketId = { $ne: excludeSocketId };
  }

  const nearbyPlayers = await Player.find(query)
    .select("socketId location")
    .lean();

  return nearbyPlayers.map((player) => ({
    socketId: player.socketId,
    x: player.location[0],
    y: player.location[1],
  }));
};
