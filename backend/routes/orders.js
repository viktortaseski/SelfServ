const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// Customer order (no login required)
router.post("/customer", async (req, res) => {
    try {
        const { tableToken, items } = req.body;

        // Lookup table by token
        const tableRes = await pool.query(
            "SELECT id FROM restaurant_tables WHERE token = $1",
            [tableToken]
        );

        if (!tableRes.rows.length) {
            return res.status(400).json({ error: "Invalid table token" });
        }

        const tableId = tableRes.rows[0].id;

        const result = await pool.query(
            "INSERT INTO orders (table_id, items, created_by_role) VALUES ($1, $2, 'customer') RETURNING *",
            [tableId, JSON.stringify(items)]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Customer order error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Waiter order (requires login)
router.post("/waiter", auth(["waiter", "admin"]), async (req, res) => {
    try {
        const { tableToken, items } = req.body;

        // Lookup table by token
        const tableRes = await pool.query(
            "SELECT id FROM restaurant_tables WHERE token = $1",
            [tableToken]
        );

        if (!tableRes.rows.length) {
            return res.status(400).json({ error: "Invalid table token" });
        }

        const tableId = tableRes.rows[0].id;

        const result = await pool.query(
            "INSERT INTO orders (table_id, items, created_by_role, waiter_id) VALUES ($1, $2, 'waiter', $3) RETURNING *",
            [tableId, JSON.stringify(items), req.user.id]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error("Waiter order error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
