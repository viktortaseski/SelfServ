const express = require("express");
const pool = require("../db");

const router = express.Router();

// Register waiter/admin (manual via DB, not public API)
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
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Login (plain text version with session)
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("➡️ Login attempt:", { username, password });

        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        if (password !== user.password) {
            console.log("❌ Password mismatch for user", username);
            return res.status(400).json({ error: "Invalid password" });
        }

        req.session.user = { id: user.id, role: user.role, username: user.username };
        console.log("✅ Session created:", req.session.user);

        res.json({ success: true, role: user.role, username: user.username });
    } catch (err) {
        console.error("💥 Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ⭐ NEW: check current session
router.get("/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "Not logged in" });
    }
    res.json(req.session.user);
});

// ⭐ NEW: logout
router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

module.exports = router;
