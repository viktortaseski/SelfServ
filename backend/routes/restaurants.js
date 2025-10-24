const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { DEFAULT_RESTAURANT_ID } = require("../config");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";

function parseRestaurantId(value, fallback = null) {
    if (value == null) return fallback;
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) return fallback;
    return num;
}

function parseRestaurantIdFromReq(req) {
    const candidates = [
        req.query?.restaurantId,
        req.query?.restaurant_id,
        req.body?.restaurantId,
        req.body?.restaurant_id,
        req.params?.restaurantId,
        req.params?.restaurant_id,
    ];
    for (const cand of candidates) {
        const parsed = parseRestaurantId(cand, null);
        if (parsed != null) return parsed;
    }
    return DEFAULT_RESTAURANT_ID;
}

function readBearer(req) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return null;
    return auth.slice(7);
}

function toBool(raw, fallback = null) {
    if (typeof raw === "boolean") return raw;
    if (raw == null) return fallback;
    const str = String(raw).trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(str)) return true;
    if (["0", "false", "no", "n", "off"].includes(str)) return false;
    return fallback;
}

async function requireAdmin(req, res, next) {
    try {
        const token = readBearer(req);
        if (!token) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || decoded.role !== "admin") {
            return res.status(403).json({ error: "Forbidden" });
        }
        const { rows } = await pool.query(
            `
            SELECT id, restaurant_id, role, is_active
              FROM employees
             WHERE id = $1
             LIMIT 1
        `,
            [decoded.id]
        );
        if (!rows.length) {
            return res.status(401).json({ error: "Account unavailable" });
        }
        const admin = rows[0];
        if (admin.role !== "admin" || !admin.is_active) {
            return res.status(403).json({ error: "Forbidden" });
        }
        req.admin = {
            id: Number(admin.id),
            restaurantId: Number(admin.restaurant_id || DEFAULT_RESTAURANT_ID),
            role: admin.role,
        };
        return next();
    } catch (err) {
        if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Invalid token" });
        }
        console.error("[restaurants] requireAdmin error:", err);
        return res.status(500).json({ error: "Server error" });
    }
}

function mapRestaurant(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        name: row.name || null,
        is_active: !!row.is_active,
    };
}

router.get("/status", async (req, res) => {
    try {
        const restaurantId = parseRestaurantIdFromReq(req);
        if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
            return res.status(400).json({ error: "Invalid restaurantId" });
        }

        const { rows } = await pool.query(
            `
            SELECT id, name, is_active
              FROM restaurants
             WHERE id = $1
             LIMIT 1
        `,
            [restaurantId]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        return res.json({ restaurant: mapRestaurant(rows[0]) });
    } catch (err) {
        console.error("GET /restaurants/status error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.patch("/admin/status", requireAdmin, async (req, res) => {
    const restaurantId = req.admin.restaurantId;
    const isActive = toBool(req.body?.isActive ?? req.body?.is_active, null);
    if (isActive == null) {
        return res.status(400).json({ error: "Invalid isActive value" });
    }

    try {
        const { rows } = await pool.query(
            `
            UPDATE restaurants
               SET is_active = $1
             WHERE id = $2
            RETURNING id, name, is_active
        `,
            [isActive, restaurantId]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        return res.json({ restaurant: mapRestaurant(rows[0]) });
    } catch (err) {
        console.error("PATCH /restaurants/admin/status error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
