
const express = require("express");
const cors = require("cors");
const authRoutes = require("./src/routes/auth.routes");
const roomRoutes = require("./src/routes/room.routes");
const redisClient = require("./src/config/redis");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  const redisReady = redisClient.isReady;

  const status = {
    success: redisReady,
    backend: "ok",
    redis: redisReady ? "connected" : "disconnected",
  };

  res.status(redisReady ? 200 : 503).json(status);
});

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

module.exports = app;
