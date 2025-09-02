const express = require("express");
const router = express.Router();
const db = require("../db");

// POST new order
router.post("/", async (req, res) => {
    const { tableToken, items } = req.body;

    try {
        // Get table ID from token
        const tableResult = await db.query(
            "SELECT * FROM tables WHERE token = $1",
            [tableToken]
        );

        if (tableResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid table" });
        }

        const tableId = tableResult.rows[0].id;

        // Insert order and return id
        const orderResult = await db.query(
            "INSERT INTO orders (table_id, status) VALUES ($1, 'pending') RETURNING id",
            [tableId]
        );
        const orderId = orderResult.rows[0].id;

        // Insert order items
        for (let item of items) {
            await db.query(
                "INSERT INTO order_items (order_id, menu_item_id, quantity) VALUES ($1, $2, $3)",
                [orderId, item.id, item.quantity]
            );
        }

        res.json({ success: true, orderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
