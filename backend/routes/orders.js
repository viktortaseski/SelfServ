// routes/orders.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

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

// routes/orders.js (append near the bottom)
const authMiddleware = require("../middleware/auth");

// GET /api/orders/admin (admin-only, session auth)
// Query params: from,to (ISO), status, tableId, q, limit
router.get("/admin", authMiddleware(["admin"]), async (req, res) => {
    try {
        const { from, to, status, tableId, q, limit } = req.query;

        // Defaults: last 7 days if not provided
        const lim = Math.min(Math.max(parseInt(limit || "100", 10), 1), 1000);

        // Build dynamic WHERE with params
        const where = [];
        const params = [];
        let idx = 1;

        if (from) {
            where.push(`o.created_at >= $${idx++}`);
            params.push(new Date(from));
        }
        if (to) {
            where.push(`o.created_at <= $${idx++}`);
            params.push(new Date(to));
        }
        if (status) {
            where.push(`o.status = $${idx++}`);
            params.push(String(status));
        }
        if (tableId) {
            where.push(`o.table_id = $${idx++}`);
            params.push(Number(tableId));
        }
        if (q) {
            // Search across order id, table name, item name
            where.push(`(
        CAST(o.id AS TEXT) ILIKE $${idx}
        OR rt.name ILIKE $${idx}
        OR mi.name ILIKE $${idx}
      )`);
            params.push(`%${q}%`);
            idx++;
        }

        const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

        // Join + aggregate items per order
        const sql = `
      WITH base AS (
        SELECT
          o.id,
          o.table_id,
          rt.name AS table_name,
          o.status,
          o.tip,
          o.created_at,
          oi.quantity,
          mi.name AS item_name,
          mi.price AS item_price,
          oi.note AS item_note
        FROM orders o
        JOIN restaurant_tables rt ON rt.id = o.table_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        ${whereSQL}
      ),
      roll AS (
        SELECT
          id,
          table_id,
          table_name,
          status,
          tip,
          created_at,
          SUM(quantity * item_price) AS subtotal,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'name', item_name,
              'quantity', quantity,
              'price', item_price,
              'note', item_note
            ) ORDER BY item_name
          ) AS items
        FROM base
        GROUP BY id, table_id, table_name, status, tip, created_at
        ORDER BY created_at DESC
        LIMIT $${idx}
      )
      SELECT * FROM roll;
    `;

        params.push(lim);

        const result = await pool.query(sql, params);
        // Ensure ISO strings for created_at
        const rows = (result.rows || []).map((r) => ({
            ...r,
            created_at:
                r.created_at && typeof r.created_at.toISOString === "function"
                    ? r.created_at.toISOString()
                    : r.created_at,
            items: Array.isArray(r.items) ? r.items : [],
            subtotal: Number(r.subtotal || 0),
            tip: Number(r.tip || 0),
        }));

        res.json(rows);
    } catch (err) {
        console.error("GET /orders/admin error:", err);
        res.status(500).json({ error: "Server error" });
    }
});



module.exports = router;
