
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const connectDB = require("./src/config/db");
const redisClient = require("./src/config/redis");
const app = require("./app");

const { registerMovementHandlers } = require("./src/sockets/movement");
const { registerWebRTCHandlers } = require("./src/sockets/webrtc");
const {
  registerSocketUserMapping,
} = require("./src/sockets/socketUserMapping");

const PORT = process.env.PORT || 3000;

let httpServer;
let io;
let redisSubscriber;
let isShuttingDown = false;

async function startServer() {
  try {
    // Connect to MongoDB and Redis publisher
    await connectDB();
    console.log("MongoDB connected successfully");

    await redisClient.connect();
    console.log("Redis publisher connected");

    // Create a separate Redis subscriber connection
    redisSubscriber = redisClient.duplicate();
    await redisSubscriber.connect();
    console.log("Redis subscriber connected");

    // Create HTTP server and Socket.IO
    httpServer = http.createServer(app);

    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Enable communication between Socket.IO server instances
    io.adapter(createAdapter(redisClient, redisSubscriber));

    // Preserve existing event handlers
    registerMovementHandlers(io);
    registerWebRTCHandlers(io);
    registerSocketUserMapping(io);

    httpServer.listen(PORT, () => {
      console.log(`ProxiSpeak backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start ProxiSpeak backend:", error.message);
    await shutdown(1);
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("Shutting down ProxiSpeak backend...");

  try {
    if (io) {
      await new Promise((resolve) => io.close(resolve));
    } else if (httpServer?.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    if (redisSubscriber?.isOpen) {
      await redisSubscriber.quit();
    }

    if (redisClient.isOpen) {
      await redisClient.quit();
    }

    console.log("Redis connections closed");
  } catch (error) {
    console.error("Error during shutdown:", error.message);
    exitCode = 1;
  } finally {
    process.exitCode = exitCode;
  }
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

startServer();
