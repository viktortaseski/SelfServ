// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tokenRoutes = require("./routes/tokens");
const printJobsRoutes = require("./routes/printJobs");
const restaurantRoutes = require("./routes/restaurants");
// const tableRoutes = require("./routes/tables"); // removed in v1
const usersRouter = require("./routes/users"); // removed in v1
const { runMigrations } = require("./migrations");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = [
    "https://selfservscaled.onrender.com",
    "http://localhost:3000",
    "http://localhost:3001",
    ...(process.env.CORS_ORIGINS || "")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow non-browser requests (curl, server-to-server) with no origin
            if (!origin) return callback(null, true);
            // Allow explicit allowlist and any Vercel deployment (prod + previews)
            if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
                return callback(null, true);
            }
            return callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Allow larger JSON bodies for image uploads (base64)
app.use(bodyParser.json({ limit: '10mb' }));

// Lightweight health check for uptime pingers (keeps the host awake without touching the DB)
app.get(["/health", "/api/health"], (req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Serve uploaded files (e.g., menu item images)
const uploadsDir = path.resolve(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Customer-facing routes only
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/print-jobs", printJobsRoutes);
app.use("/api/restaurants", restaurantRoutes);

// Removed waiter-only routes:
// app.use("/api/tables", tableRoutes);
app.use("/api/users", usersRouter);

// Removed debug session endpoint (no sessions in v1).
// app.get("/api/debug/session", ...)

const PORT = process.env.PORT || 5000;

async function start() {
    try {
        await runMigrations();
    } catch (err) {
        console.error("[startup] Failed to run migrations", err);
        process.exit(1);
    }

    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}

start();
