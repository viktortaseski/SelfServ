// backend/server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const usersRouter = require("./routes/users");
const pool = require("./db"); // make sure your db.js exports the pg Pool

const app = express();

/**
 * IMPORTANT behind Render/HTTPS:
 * trust proxy so express-session knows the request is secure
 */
app.set("trust proxy", 1);

// CORS
app.use(
    cors({
        origin: [
            "https://selfserv-web.onrender.com", // frontend
            "http://localhost:3000",             // dev
        ],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Set-Cookie"],
        credentials: true,
    })
);

app.use(bodyParser.json());

/**
 * Use Postgres-backed session store so sessions persist across
 * restarts and multiple instances.
 */
app.use(
    session({
        store: new pgSession({
            pool, // reuse your existing pg Pool
            tableName: "user_sessions", // will be created automatically
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET || "keyboardcat",
        resave: false,
        saveUninitialized: false,
        cookie: {
            // Keep the cookie simple and reliable:
            // host-only cookie (no domain) => valid for selfserv.onrender.com
            secure: true,     // HTTPS only (Render is HTTPS)
            httpOnly: true,
            sameSite: "none", // allow cross-site XHR from your frontend
            // NOTE: do NOT set `domain`. Host-only cookie is more reliable.
            maxAge: 1000 * 60 * 60 * 8, // 8 hours
        },
        name: "sid", // cookie name (optional)
    })
);

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/users", usersRouter);

// Debug route (optional): check session server-side quickly
app.get("/api/debug/session", (req, res) => {
    res.json({
        hasUser: !!(req.session && req.session.user),
        user: req.session?.user || null,
        cookie: req.session?.cookie || null,
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
