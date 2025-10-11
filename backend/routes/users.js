// routes/users.js
const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

// Helper: parse Bearer token
function readBearer(req) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return null;
    return auth.slice(7);
}

router.post("/register", async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!["waiter", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const result = await pool.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
            [username, password, role]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Login (NO SESSIONS) -> returns JWT
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        if (password !== user.password) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const payload = { id: user.id, role: user.role, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        return res.json({ success: true, token, role: user.role, username: user.username });
    } catch (err) {
        console.error("💥 Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Me (NO SESSIONS) -> verifies JWT from Authorization header
router.get("/me", (req, res) => {
    try {
        const token = readBearer(req);
        if (!token) return res.status(401).json({ error: "Not logged in" });

        const decoded = jwt.verify(token, JWT_SECRET);
        return res.json(decoded); // { id, role, username, iat, exp }
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
});

// Logout is a no-op without sessions; client just drops the token
router.post("/logout", (_req, res) => {
    res.json({ success: true });
});

module.exports = router;
