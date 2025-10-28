const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { DEFAULT_RESTAURANT_ID } = require("../config");

const router = express.Router();

// Optional receipt header defaults (can override with env on Render)
const RECEIPT_NAME = "SELFSERV";
const RECEIPT_PHONE = "69 937 000";
const RECEIPT_ADDRESS = "Koper";

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";

function requireRoles(roles = []) {
    return (req, res, next) => {
        const auth = req.headers.authorization || "";
        if (!auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const token = auth.slice(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ error: "Forbidden: insufficient role" });
            }
            req.user = decoded;
            next();
        } catch {
            return res.status(401).json({ error: "Invalid token" });
        }
    };
}

function pickRestaurantId(req) {
    const fromUser = Number(req?.user?.restaurant_id);
    if (Number.isFinite(fromUser) && fromUser > 0) return fromUser;
    return DEFAULT_RESTAURANT_ID;
}

function toTipInt(tip) {
    const n = Number(tip);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
}

function roundMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100) / 100;
}

async function findDefaultPrinterId(dbOrPool, restaurantId) {
    if (!Number.isFinite(Number(restaurantId))) return null;
    const runner = dbOrPool && typeof dbOrPool.query === "function" ? dbOrPool : pool;
    const { rows } = await runner.query(
        `
        SELECT id
          FROM restaurant_printer
         WHERE restaurant_id = $1
           AND COALESCE(is_active, TRUE) = TRUE
         ORDER BY id
         LIMIT 1
    `,
        [restaurantId]
    );
    if (rows.length === 0) return null;
    return Number(rows[0].id);
}

async function consumeAccessToken(client, accessToken) {
    const q = `
        SELECT
            tat.table_id,
            rt.restaurant_id,
            rt.name AS table_name
        FROM table_access_tokens tat
        JOIN restaurant_tables rt ON rt.id = tat.table_id
        WHERE tat.token = $1
          AND tat.used_at IS NULL
          AND (tat.expires_at IS NULL OR tat.expires_at > NOW())
        FOR UPDATE
    `;
    const res = await client.query(q, [accessToken]);
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    await client.query(
        "UPDATE table_access_tokens SET used_at = NOW() WHERE token = $1",
        [accessToken]
    );
    return {
        tableId: Number(row.table_id),
        restaurantId: Number(row.restaurant_id),
        tableName: row.table_name,
    };
}

async function fetchMenuItems(client, ids) {
    if (!ids.length) return [];
    const { rows } = await client.query(
        `
        SELECT
            rp.id,
            rp.restaurant_id,
            rp.category_id,
            rp.price,
            rp.is_active,
            rp.img_url,
            p.name,
            p.description,
            c.slug AS category_slug,
            c.name AS category_name
        FROM restaurant_products rp
        JOIN products p ON p.id = rp.product_id
        LEFT JOIN categories c ON c.id = rp.category_id
        WHERE rp.id = ANY($1)
    `,
        [ids]
    );
    return rows.map((row) => ({
        ...row,
        id: Number(row.id),
        restaurant_id: Number(row.restaurant_id),
        price: Number(row.price),
        is_active: row.is_active === true || row.is_active === "t",
        category_id: row.category_id != null ? Number(row.category_id) : null,
        category_slug: row.category_slug || null,
        category_name: row.category_name || null,
    }));
}

async function insertOrderItems(client, orderId, items) {
    const insertSql = `
        INSERT INTO order_items (order_id, restaurant_product_id, quantity, total_price, note)
        VALUES ($1, $2, $3, $4, $5)
    `;
    let subtotal = 0;
    for (const item of items) {
        const quantity = Math.max(1, Math.round(Number(item.quantity) || 0));
        const unitPrice = roundMoney(item.price);
        const totalPrice = roundMoney(unitPrice * quantity);
        const note = item.note ? String(item.note).slice(0, 45) : null;
        subtotal += totalPrice;
        await client.query(insertSql, [
            orderId,
            item.restaurant_product_id,
            quantity,
            totalPrice,
            note,
        ]);
    }
    return roundMoney(subtotal);
}

router.post("/customer", async (req, res) => {
    const { accessToken, items, tip } = req.body || {};

    if (!accessToken) {
        return res.status(400).json({ error: "Missing accessToken" });
    }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    const normalizedItems = items.map((it) => ({
        id: Number(it.id),
        quantity: Math.max(1, Math.round(Number(it.quantity) || 0)),
        note: it.note ? String(it.note).slice(0, 45) : null,
    }));
    console.log("[orders] normalized cart items:", normalizedItems);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const tokenData = await consumeAccessToken(client, accessToken);
        if (!tokenData) {
            await client.query("ROLLBACK");
            return res
                .status(400)
                .json({ error: "Expired or already used token. Please rescan the QR." });
        }
        //console.log("[orders] token data:", tokenData);

        const ids = [...new Set(normalizedItems.map((it) => it.id).filter((id) => Number.isFinite(id) && id > 0))];
        if (!ids.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Cart items are invalid" });
        }
        //console.log("[orders] unique item ids:", ids);

        const rows = await fetchMenuItems(client, ids);
        //console.log("[orders] fetched restaurant_products:", rows);
        const productMap = new Map(rows.map((row) => [row.id, row]));

        const missingIds = ids.filter((id) => !productMap.has(id));
        if (missingIds.length) {
            await client.query("ROLLBACK");
            console.warn("[orders] missing restaurant_products", { missingIds });
            return res.status(400).json({
                error: "Some items are no longer available. Please refresh your cart.",
                missingItems: missingIds,
                missingNames: [],
            });
        }

        const foreignItems = ids.filter((id) => productMap.get(id)?.restaurant_id !== tokenData.restaurantId);
        if (foreignItems.length) {
            const foreignNames = foreignItems
                .map((id) => productMap.get(id)?.name)
                .filter(Boolean);
            await client.query("ROLLBACK");
            console.warn("[orders] items from different restaurant", { restaurantId: tokenData.restaurantId, foreignItems, foreignNames });
            return res.status(400).json({
                error: "Some items are from a different restaurant. Please refresh your cart.",
                invalidItems: foreignItems,
                invalidNames: foreignNames,
            });
        }

        const inactiveItems = ids.filter((id) => !productMap.get(id)?.is_active);
        if (inactiveItems.length) {
            const inactiveNames = inactiveItems
                .map((id) => productMap.get(id)?.name)
                .filter(Boolean);
            await client.query("ROLLBACK");
            console.warn("[orders] inactive items detected", { inactiveItems, inactiveNames });
            return res.status(400).json({
                error: "Some items are no longer available. Please refresh your cart.",
                inactiveItems,
                inactiveNames,
            });
        }

        const orderItems = normalizedItems.map((item) => {
            const product = productMap.get(item.id);
            const categoryName =
                product.category_name ||
                product.category_slug ||
                "Uncategorized";
            return {
                restaurant_product_id: product.id,
                name: product.name,
                price: roundMoney(product.price),
                quantity: item.quantity,
                note: item.note,
                img_url: product.img_url,
                category_id: product.category_id,
                category_slug: product.category_slug,
                category_name: categoryName,
            };
        });

        const tipInt = toTipInt(tip);

        const orderRes = await client.query(
            `
            INSERT INTO orders (
                restaurant_id,
                table_id,
                total_price,
                tip,
                status,
                created_by_role
            )
            VALUES ($1, $2, 0, $3, 'open', 'customer')
            RETURNING id, created_at
        `,
            [tokenData.restaurantId, tokenData.tableId, tipInt]
        );

        const orderId = orderRes.rows[0].id;
        const createdAt = orderRes.rows[0].created_at;
        const createdAtISO =
            createdAt instanceof Date ? createdAt.toISOString() : new Date().toISOString();

        const subtotal = await insertOrderItems(client, orderId, orderItems);
        await client.query(
            "UPDATE orders SET total_price = $1 WHERE id = $2",
            [subtotal, orderId]
        );

        const restaurantInfoRes = await client.query(
            `
            SELECT
                id,
                name,
                address,
                phone_number,
                tax_id
            FROM restaurants
            WHERE id = $1
            LIMIT 1
        `,
            [tokenData.restaurantId]
        );
        const restaurantInfo = restaurantInfoRes.rows[0] || null;

        await client.query("COMMIT");

        const tableName = tokenData.tableName || `Table ${tokenData.tableId}`;
        const purchasedItems = orderItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            note: item.note,
            image_url: item.img_url,
            category_id: item.category_id,
            category_slug: item.category_slug,
            category_name: item.category_name,
        }));

        const itemsByCategory = [];
        const categoryOrder = new Map();
        for (const item of purchasedItems) {
            const categoryKey = item.category_slug || item.category_name || "uncategorized";
            if (!categoryOrder.has(categoryKey)) {
                categoryOrder.set(categoryKey, {
                    category_id: item.category_id,
                    category_slug: item.category_slug,
                    category_name: item.category_name || "Uncategorized",
                    items: [],
                });
                itemsByCategory.push(categoryOrder.get(categoryKey));
            }
            const entry = categoryOrder.get(categoryKey);
            entry.items.push({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                note: item.note,
                image_url: item.image_url,
            });
        }

        const targetPrinterId = await findDefaultPrinterId(client, tokenData.restaurantId);
        const printPayload = {
            orderId,
            tableName,
            createdAtISO,
            items: purchasedItems,
            itemsByCategory,
            subtotal,
            tip: tipInt,
            taxRate: 0,
            payment: "PAYMENT DUE",
            headerTitle: RECEIPT_NAME,
            phone: restaurantInfo?.phone_number || RECEIPT_PHONE,
            address: restaurantInfo?.address || RECEIPT_ADDRESS,
            taxId: restaurantInfo?.tax_id || null,
            restaurant: restaurantInfo
                ? {
                    id: restaurantInfo.id,
                    name: restaurantInfo.name,
                    address: restaurantInfo.address,
                    phone_number: restaurantInfo.phone_number,
                    tax_id: restaurantInfo.tax_id,
                }
                : {
                    id: tokenData.restaurantId,
                    name: RECEIPT_NAME,
                },
            printerId: targetPrinterId,
        };

        await pool.query(
            `INSERT INTO print_jobs (order_id, payload, status, printer_id) VALUES ($1, $2, 'queued', $3)`,
            [orderId, printPayload, targetPrinterId]
        );

        return res.status(201).json({ orderId });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => { });
        console.error("POST /orders/customer error:", err);
        if (err && err.message && /not found|unavailable|restaurant/i.test(err.message)) {
            return res.status(400).json({ error: err.message });
        }
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

router.get("/admin", requireRoles(["admin"]), async (req, res) => {
    try {
        const restaurantId = pickRestaurantId(req);
        const { from, to, status, tableId, q, limit } = req.query;

        const lim = Math.min(Math.max(parseInt(limit || "100", 10), 1), 1000);

        const where = ["o.restaurant_id = $1"];
        const params = [restaurantId];
        let idx = params.length;

        if (from) {
            where.push(`o.created_at >= $${++idx}`);
            params.push(new Date(from));
        }
        if (to) {
            where.push(`o.created_at <= $${++idx}`);
            params.push(new Date(to));
        }
        if (status) {
            where.push(`o.status = $${++idx}`);
            params.push(String(status));
        }
        if (tableId) {
            where.push(`o.table_id = $${++idx}`);
            params.push(Number(tableId));
        }
        if (q) {
            where.push(`(
                CAST(o.id AS TEXT) ILIKE $${++idx}
                OR rt.name ILIKE $${idx}
                OR p.name ILIKE $${idx}
            )`);
            params.push(`%${q}%`);
        }

        params.push(lim);

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
                    oi.total_price,
                    oi.note,
                    p.name AS item_name
                FROM orders o
                LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
                JOIN order_items oi ON oi.order_id = o.id
                JOIN restaurant_products rp ON rp.id = oi.restaurant_product_id
                JOIN products p ON p.id = rp.product_id
                WHERE ${where.join(" AND ")}
            ),
            roll AS (
                SELECT
                    id,
                    table_id,
                    table_name,
                    status,
                    tip,
                    created_at,
                    SUM(total_price) AS subtotal,
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'name', item_name,
                            'quantity', quantity,
                            'price', CASE WHEN quantity > 0 THEN total_price / quantity ELSE 0 END,
                            'note', note
                        )
                        ORDER BY item_name
                    ) AS items
                FROM base
                GROUP BY id, table_id, table_name, status, tip, created_at
                ORDER BY created_at DESC
                LIMIT $${idx + 1}
            )
            SELECT * FROM roll;
        `;

        const result = await pool.query(sql, params);
        const rows = (result.rows || []).map((r) => ({
            ...r,
            created_at:
                r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
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
