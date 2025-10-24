const express = require("express");
const router = express.Router();
const pool = require("../db");
const crypto = require("crypto");


function parseRestaurantId(raw) {
    if (raw == null) return null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    return num > 0 ? num : null;
}

router.post("/exchange", async (req, res) => {
    const {
        tableToken,
        restaurantId: bodyRestaurantId,
        restaurant_id: bodyRestaurantIdSnake,
    } = req.body || {};

    if (!tableToken) {
        return res.status(400).json({ error: "tableToken is required" });
    }

    const requestedRestaurantId =
        parseRestaurantId(bodyRestaurantId) ??
        parseRestaurantId(bodyRestaurantIdSnake) ??
        parseRestaurantId(req?.query?.restaurantId) ??
        parseRestaurantId(req?.query?.restaurant_id);

    try {
        const conditions = ["rt.token = $1"];
        const params = [tableToken];

        if (requestedRestaurantId != null) {
            conditions.push(`rt.restaurant_id = $${params.length + 1}`);
            params.push(requestedRestaurantId);
        }

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
            WHERE ${conditions.join(" AND ")}
        `,
            params
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
