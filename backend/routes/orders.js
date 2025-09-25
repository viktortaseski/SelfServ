// routes/orders.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

// Helper: insert items for an order (matches your order_items schema)
async function insertOrderItems(client, orderId, items) {
    const text = `
    INSERT INTO order_items (order_id, menu_item_id, quantity)
    VALUES ($1, $2, $3)
  `;
    for (const it of items) {
        const menuItemId = it.id; // frontend sends item.id
        const quantity = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        await client.query(text, [orderId, menuItemId, quantity]);
    }
}

// Normalize/validate message: return {value|null} or throw 400-friendly error upstream
function normalizeMessage(raw) {
    if (raw == null) return null;           // missing is fine
    const msg = String(raw).trim();
    if (msg.length === 0) return null;      // empty → store NULL
    if (msg.length > 200) {
        const err = new Error("Message must be at most 200 characters.");
        err.status = 400;
        throw err;
    }
    return msg;                              // valid string (1..200)
}

// POST /api/orders/customer (no auth)
router.post("/customer", async (req, res) => {
    const { tableToken, items, message } = req.body;

    if (!tableToken) {
        return res.status(400).json({ error: "Missing table token" });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    let msg;
    try {
        msg = normalizeMessage(message);
    } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
    }

    const client = await pool.connect();
    try {
        const tRes = await client.query(
            "SELECT id FROM restaurant_tables WHERE token = $1",
            [tableToken]
        );
        if (tRes.rowCount === 0) {
            return res.status(400).json({ error: "Invalid table token" });
        }
        const tableId = tRes.rows[0].id;

        await client.query("BEGIN");

        const oRes = await client.query(
            `INSERT INTO orders (table_id, created_by_role, status, message)
       VALUES ($1, 'customer', 'pending', $2)
       RETURNING id`,
            [tableId, msg]
        );
        const orderId = oRes.rows[0].id;

        await insertOrderItems(client, orderId, items);

        await client.query("COMMIT");
        return res.status(201).json({ orderId });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("POST /orders/customer error:", err);
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

// POST /api/orders/waiter (auth required)
router.post("/waiter", auth(["waiter", "admin"]), async (req, res) => {
    const { tableToken, items, message } = req.body;

    if (!tableToken) {
        return res.status(400).json({ error: "Missing table token" });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    let msg;
    try {
        msg = normalizeMessage(message);
    } catch (e) {
        return res.status(e.status || 400).json({ error: e.message });
    }

    const client = await pool.connect();
    try {
        const tRes = await client.query(
            "SELECT id FROM restaurant_tables WHERE token = $1",
            [tableToken]
        );
        if (tRes.rowCount === 0) {
            return res.status(400).json({ error: "Invalid table token" });
        }
        const tableId = tRes.rows[0].id;

        await client.query("BEGIN");

        const oRes = await client.query(
            `INSERT INTO orders (table_id, created_by_role, status, waiter_id, message)
       VALUES ($1, 'waiter', 'pending', $2, $3)
       RETURNING id`,
            [tableId, req.user.id, msg]
        );
        const orderId = oRes.rows[0].id;

        await insertOrderItems(client, orderId, items);

        await client.query("COMMIT");
        return res.status(201).json({ orderId });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("POST /orders/waiter error:", err);
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

module.exports = router;
