const express = require("express");
const router = express.Router();
const db = require("../db");

// POST new order
router.post("/", async (req, res) => {
    const { tableToken, items } = req.body;

    try {
        // Get table ID from token
        const [table] = await db.query("SELECT * FROM tables WHERE token = ?", [tableToken]);
        if (!table.length) return res.status(400).json({ error: "Invalid table" });

        const tableId = table[0].id;

        // Insert order
        const [result] = await db.query("INSERT INTO orders (tableId, status) VALUES (?, 'pending')", [tableId]);
        const orderId = result.insertId;

        // Insert order items
        for (let item of items) {
            await db.query("INSERT INTO order_items (orderId, menuItemId, quantity) VALUES (?, ?, ?)", [
                orderId,
                item.id,
                item.quantity,
            ]);
        }

        res.json({ success: true, orderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
