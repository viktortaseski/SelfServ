const express = require("express");
const router = express.Router();
const pool = require("../db");
const crypto = require("crypto");


router.post("/exchange", async (req, res) => {
    const { tableToken } = req.body || {};
    if (!tableToken) {
        return res.status(400).json({ error: "tableToken is required" });
    }

    try {
        const tRes = await pool.query(
            `
            SELECT
                rt.id,
                rt.name,
                rt.restaurant_id,
                r.name AS restaurant_name,
                r.location AS restaurant_location,
                r.radius AS restaurant_radius
            FROM restaurant_tables rt
            JOIN restaurants r ON r.id = rt.restaurant_id
            WHERE rt.token = $1
        `,
            [tableToken]
        );
        if (tRes.rowCount === 0) {
            return res.status(404).json({ error: "Invalid table token" });
        }
        const table = tRes.rows[0];

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const accessToken = crypto.randomBytes(18).toString("base64url");

        await pool.query(
            `
      INSERT INTO table_access_tokens (token, table_id, expires_at)
      VALUES ($1, $2, $3)
      `,
            [accessToken, table.id, expiresAt]
        );

        return res.json({
            accessToken,
            expiresAt: expiresAt.toISOString(),
            table: {
                id: table.id,
                name: table.name,
                restaurant_id: table.restaurant_id,
                restaurant_name: table.restaurant_name,
                restaurant_location: table.restaurant_location,
                restaurant_radius: table.restaurant_radius,
            },
        });
    } catch (err) {
        console.error("POST /api/tokens/exchange error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
