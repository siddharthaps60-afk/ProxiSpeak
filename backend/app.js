
const express = require("express");
const cors = require("cors");
const authRoutes = require("./src/routes/auth.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ProxiSpeak backend is running",
  });
});

app.use("/api/auth", authRoutes);

module.exports = app;
