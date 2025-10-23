// routes/users.js
const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");
const { DEFAULT_RESTAURANT_ID } = require("../config");

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
        const {
            username,
            password,
            role,
            restaurantId = DEFAULT_RESTAURANT_ID,
        } = req.body || {};

        const trimmedUsername = String(username || "").trim();
        const trimmedPassword = String(password || "").trim();

        if (!trimmedUsername || !trimmedPassword) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        if (!["admin", "staff"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const restaurantIdNum = Number(restaurantId) || DEFAULT_RESTAURANT_ID;

        const result = await pool.query(
            `
            INSERT INTO employees (restaurant_id, role, username, password)
            VALUES ($1, $2, $3, $4)
            RETURNING id, restaurant_id, role, username
        `,
            [restaurantIdNum, role, trimmedUsername, trimmedPassword]
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

        const result = await pool.query(
            `
            SELECT e.*, r.name AS restaurant_name
            FROM employees e
            LEFT JOIN restaurants r ON r.id = e.restaurant_id
            WHERE e.username = $1
            LIMIT 1
        `,
            [username]
        );
        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: "Account disabled" });
        }
        if (password !== user.password) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const payload = {
            id: user.id,
            role: user.role,
            username: user.username,
            restaurant_id: user.restaurant_id,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        return res.json({
            success: true,
            token,
            role: user.role,
            username: user.username,
            restaurant_id: user.restaurant_id,
            restaurant_name: user.restaurant_name || null,
        });
    } catch (err) {
        console.error("💥 Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Me (NO SESSIONS) -> verifies JWT from Authorization header
router.get("/me", async (req, res) => {
    try {
        const token = readBearer(req);
        if (!token) return res.status(401).json({ error: "Not logged in" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const { rows } = await pool.query(
            `
            SELECT
                e.id,
                e.username,
                e.role,
                e.restaurant_id,
                r.name AS restaurant_name
            FROM employees e
            LEFT JOIN restaurants r ON r.id = e.restaurant_id
            WHERE e.id = $1
            LIMIT 1
        `,
            [decoded.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = rows[0];
        return res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            restaurant_id: user.restaurant_id,
            restaurant_name: user.restaurant_name || null,
        });
    } catch (err) {
        if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Invalid token" });
        }
        console.error("GET /users/me error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Logout is a no-op without sessions; client just drops the token
router.post("/logout", (_req, res) => {
    res.json({ success: true });
});

module.exports = router;
