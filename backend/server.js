
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./src/config/db");
const app = require("./app");

const { registerMovementHandlers } = require("./src/sockets/movement");
const { registerWebRTCHandlers } = require("./src/sockets/webrtc");
const {
  registerSocketUserMapping,
} = require("./src/sockets/socketUserMapping");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    registerMovementHandlers(io);
    registerWebRTCHandlers(io);
    registerSocketUserMapping(io);

    httpServer.listen(PORT, () => {
      console.log(`ProxiSpeak backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start ProxiSpeak backend:", error.message);
    process.exit(1);
  }
}

startServer();
