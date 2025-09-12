// backend/routes/tables.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/tables?token=abc
router.get("/", async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: "token is required" });

        const result = await pool.query(
            "SELECT * FROM restaurant_tables WHERE token = $1",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Invalid or expired table token" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET /api/tables error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// (Optional) GET /api/tables/:token
router.get("/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.query(
            "SELECT * FROM restaurant_tables WHERE token = $1",
            [token]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Invalid or expired table token" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("GET /api/tables/:token error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// GET /api/tables/all (for waiters/admin) → include token
router.get("/all", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, name, token FROM restaurant_tables ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching tables:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
