const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const auth = require("../middleware/auth");

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

// Login (plain text version)
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        if (password !== user.password) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({ token, role: user.role });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Create waiter (admin only)
router.post("/create-waiter", auth(["admin"]), async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query(
            "INSERT INTO users (username, password, role) VALUES ($1, $2, 'waiter') RETURNING id, username, role",
            [username, password]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Create waiter error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
