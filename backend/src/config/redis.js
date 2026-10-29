
const { createClient } = require("redis");
const { redisReconnectStrategy } = require("./redisRetry");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  socket: {
    reconnectStrategy: redisReconnectStrategy,
  },
});

redisClient.on("connect", () => {
  console.log("Connecting to Redis...");
});

redisClient.on("ready", () => {
  console.log("Redis connection ready");
});

redisClient.on("error", (error) => {
  console.error("Redis connection error:", error.message);
});

redisClient.on("reconnecting", () => {
  console.log("Reconnecting to Redis...");
});

module.exports = redisClient;
