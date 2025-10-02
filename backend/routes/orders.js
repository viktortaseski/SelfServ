// routes/orders.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

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

async function consumeAccessToken(client, accessToken) {
    const q = `
    SELECT tat.table_id
    FROM table_access_tokens tat
    WHERE tat.token = $1
      AND tat.used_at IS NULL
      AND tat.expires_at > NOW()
    FOR UPDATE
  `;
    const res = await client.query(q, [accessToken]);
    if (res.rowCount === 0) return null;

    const tableId = res.rows[0].table_id;
    await client.query(
        "UPDATE table_access_tokens SET used_at = NOW() WHERE token = $1",
        [accessToken]
    );
    return tableId;
}

// Helper to coerce tip -> non-negative integer
function toTipInt(tip) {
    const n = Number(tip);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
}

// POST /api/orders/customer (no auth)
router.post("/customer", async (req, res) => {
    const { accessToken, items, tip, message } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: "Missing accessToken" });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const tableId = await consumeAccessToken(client, accessToken);
        if (!tableId) {
            await client.query("ROLLBACK");
            return res
                .status(400)
                .json({ error: "Expired or already used token. Please rescan the QR." });
        }

        const tipInt = toTipInt(tip);
        const trimmedMsg = (message || "").slice(0, 200) || null;

        const oRes = await client.query(
            `INSERT INTO orders (table_id, created_by_role, status, message, tip)
       VALUES ($1, 'customer', 'pending', $2, $3)
       RETURNING id`,
            [tableId, trimmedMsg, tipInt]
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

module.exports = router;
