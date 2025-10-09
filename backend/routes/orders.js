// routes/orders.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Optional receipt header defaults (can override with env on Render)
const RECEIPT_NAME = "SELFSERV";
const RECEIPT_PHONE = "69 937 000";
const RECEIPT_ADDRESS = "Koper";

async function insertOrderItems(client, orderId, items) {
    const text = `
    INSERT INTO order_items (order_id, menu_item_id, quantity, note)
    VALUES ($1, $2, $3, $4)
  `;
    for (const it of items) {
        const menuItemId = Number(it.id);
        const quantity = Math.max(1, Math.round(Number(it.quantity) || 0));
        const note = it.note ? String(it.note).slice(0, 45) : null;
        await client.query(text, [orderId, menuItemId, quantity, note]);
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
    const { accessToken, items, tip } = req.body;

    if (!accessToken) return res.status(400).json({ error: "Missing accessToken" });
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    // Normalize items: ensure quantity int >=1 and note <= 45
    const normalizedItems = items.map((it) => ({
        id: Number(it.id),
        name: String(it.name || ""),
        price: Number(it.price) || 0,
        quantity: Math.max(1, Math.round(Number(it.quantity) || 0)),
        note: it.note ? String(it.note).slice(0, 45) : null,
    }));

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const tableId = await consumeAccessToken(client, accessToken);
        if (!tableId) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Expired or already used token. Please rescan the QR." });
        }

        const tipInt = toTipInt(tip);

        // orders: drop message column usage
        const oRes = await client.query(
            `INSERT INTO orders (table_id, created_by_role, status, tip)
       VALUES ($1, 'customer', 'pending', $2)
       RETURNING id, created_at`,
            [tableId, tipInt]
        );
        const orderId = oRes.rows[0].id;
        const createdAt = oRes.rows[0].created_at;
        const createdAtISO =
            (createdAt && typeof createdAt.toISOString === "function")
                ? createdAt.toISOString()
                : new Date().toISOString();

        await insertOrderItems(client, orderId, normalizedItems);

        let tableName = null;
        try {
            const tRes = await client.query(
                `SELECT name FROM restaurant_tables WHERE id = $1`,
                [tableId]
            );
            tableName = tRes.rows[0]?.name || `Table ${tableId}`;
        } catch {
            tableName = `Table ${tableId}`;
        }

        await client.query("COMMIT");

        // Build print payload (include per-item notes; remove order-level note)
        const purchasedItems = normalizedItems.map(i => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            note: i.note,              // <— NEW: note per line
        }));
        const subtotal = purchasedItems.reduce((s, it) => s + it.price * it.quantity, 0);
        const tipVal = tipInt || 0;

        const printPayload = {
            orderId,
            tableName,
            createdAtISO,
            items: purchasedItems,
            subtotal,
            tip: tipVal,
            taxRate: 0,
            payment: "PAYMENT DUE",
            headerTitle: RECEIPT_NAME,
            phone: RECEIPT_PHONE,
            address: RECEIPT_ADDRESS,
            // removed: note (order-level)
        };

        await pool.query(
            `INSERT INTO print_jobs (order_id, payload, status) VALUES ($1, $2, 'queued')`,
            [orderId, printPayload]
        );

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
