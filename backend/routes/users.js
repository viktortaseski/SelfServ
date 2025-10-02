const express = require("express");
const pool = require("../db");
const router = express.Router();


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

// Login (session-based)
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("➡️ Login attempt:", { username, password });

        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        if (password !== user.password) {
            console.log("❌ Password mismatch");
            return res.status(400).json({ error: "Invalid password" });
        }

        // Regenerate to avoid fixation + ensure we persist user
        req.session.regenerate(err => {
            if (err) {
                console.error("Session regenerate error:", err);
                return res.status(500).json({ error: "Server error" });
            }

            req.session.user = { id: user.id, role: user.role, username: user.username };
            req.session.save(err2 => {
                if (err2) {
                    console.error("Session save error:", err2);
                    return res.status(500).json({ error: "Server error" });
                }
                console.log("✅ Session created & saved:", req.session.user, " REQ.SESSION ", req.session);
                return res.json({ success: true, role: user.role, username: user.username });
            });
        });
    } catch (err) {
        console.error("💥 Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/me", (req, res) => {
    console.log("🔎 /users/me session:", req.session);
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Not logged in" });
    }
    res.json(req.session.user);
});

// Logout
router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

module.exports = router;
