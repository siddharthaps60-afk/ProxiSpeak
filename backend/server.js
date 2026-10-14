
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./src/config/db");
const app = require("./app");
const { registerMovementHandlers } = require("./src/sockets/movement");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to MongoDB before starting the server
    await connectDB();

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

    registerMovementHandlers(io);

    httpServer.listen(PORT, () => {
      console.log(`ProxiSpeak backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start ProxiSpeak backend:", error.message);
    process.exit(1);
  }
}

startServer();
