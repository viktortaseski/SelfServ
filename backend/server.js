// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tokenRoutes = require("./routes/tokens");
const printJobsRoutes = require("./routes/printJobs");
// const tableRoutes = require("./routes/tables"); // removed in v1
const usersRouter = require("./routes/users"); // removed in v1
const { runMigrations } = require("./migrations");

const app = express();

app.set("trust proxy", 1);

app.use(
    cors({
        origin: [
            "https://selfservscaled.onrender.com",
            "http://localhost:3000",
        ],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

// Allow larger JSON bodies for image uploads (base64)
app.use(bodyParser.json({ limit: '10mb' }));

// Serve uploaded files (e.g., menu item images)
const uploadsDir = path.resolve(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Customer-facing routes only
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/print-jobs", printJobsRoutes);

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
