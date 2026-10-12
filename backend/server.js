require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./src/config/db");
const app = require("./app");


connectDB();
const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

const io = new Server(httpServer,{
  cors:{
    origin: "*",
    methods: ["GET", "POST"],
  }
})


io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("disconnect", ()=>{
    console.log("User disconnected:", socket.id);
  })
});

const {registerMovementHandlers} = require("./src/sockets/movement");

registerMovementHandlers(io);


httpServer.listen(PORT, () => {
  console.log(`ProxiSpeak backend running on port ${PORT}`);
});
