// routes/menu.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

/**
 * GET /api/menu
 * Optional: ?search=espresso
 */
router.get("/", async (req, res) => {
    try {
        const search = req.query.search;
        let result;

        if (search) {
            result = await pool.query(
                "SELECT * FROM menu_items WHERE LOWER(name) LIKE LOWER($1)",
                [`%${search}%`]
            );
        } else {
            result = await pool.query("SELECT * FROM menu_items ORDER BY id ASC");
        }

        res.json(result.rows);
    } catch (err) {
        console.error("GET /api/menu error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * GET /api/menu/top-picks
 * Returns the most-ordered menu items by total quantity.
 *
 * Query params:
 *   - category: (optional) limit results to this category (e.g., "coffee")
 *   - limit: (optional) number of items to return (default 10, max 50)
 */
router.get("/top-picks", async (req, res) => {
    const category = (req.query.category || "").trim();
    const limit = Math.min(
        Math.max(parseInt(req.query.limit || "10", 10), 1),
        50
    );

    // Aggregate quantities from order_items (+orders join if you want status filters)
    // If category is supplied, restrict the base menu_items before ordering.
    const hasCategory = category.length > 0;
    const params = [];
    let idx = 1;

    const whereClause = hasCategory ? `WHERE mi.category = $${idx++}` : "";

    if (hasCategory) params.push(category);

    params.push(limit); // last param is always limit

    const sql = `
    SELECT
      mi.id,
      mi.name,
      mi.price,
      mi.category,
      mi.image_url,
      COALESCE(s.total_qty, 0)::bigint AS total_qty
    FROM menu_items mi
    LEFT JOIN (
      SELECT
        oi.menu_item_id,
        SUM(oi.quantity)::bigint AS total_qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.quantity > 0
      GROUP BY oi.menu_item_id
    ) s ON s.menu_item_id = mi.id
    ${whereClause}
    ORDER BY s.total_qty DESC NULLS LAST, mi.id ASC
    LIMIT $${idx}
  `;

    try {
        const { rows } = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error("GET /api/menu/top-picks error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
