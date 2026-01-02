const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Mount routes
app.use("/api/auth", authRoutes);

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to MERN Auth API",
    version: "1.0.0",
    endpoints: {
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
      forgotPassword: "POST /api/auth/forgot-password",
      getCurrentUser: "GET /api/auth/me (requires token)",
    },
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
