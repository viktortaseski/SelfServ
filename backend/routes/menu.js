const express = require("express");
const router = express.Router();
const pool = require("../db");

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

router.get("/top-picks", async (req, res) => {
    const category = (req.query.category || "").trim();
    const limit = Math.min(
        Math.max(parseInt(req.query.limit || "10", 10), 1),
        50
    );

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
