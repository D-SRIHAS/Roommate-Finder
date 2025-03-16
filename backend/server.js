const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protectedRoute"); // ✅ Import protected routes
const userRoutes = require("./routes/user"); // ✅ Import user routes

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log(err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes); // ✅ Add protected routes
app.use("/api/user", userRoutes); // ✅ Register user routes

app.get("/", (req, res) => {
  res.send("🚀 Backend is running...");
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

