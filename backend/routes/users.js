const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const router = express.Router();

// Register waiter/admin (done manually by manager, not public)
router.post("/register", async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!["waiter", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const hashed = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
            [username, hashed, role]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(400).json({ error: "Invalid password" });

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

module.exports = router;
