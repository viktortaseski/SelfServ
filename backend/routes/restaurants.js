const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { uploadRestaurantLogo } = require("../services/storage");
const { DEFAULT_RESTAURANT_ID } = require("../config");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || null;
const LOGO_UPLOAD_DIR = path.resolve(__dirname, "../uploads/logos");
const fsp = fs.promises;

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

function getBaseUrl(req) {
    if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, "");
    const protoHeader = (req.headers["x-forwarded-proto"] || "").split(",")[0];
    const proto = protoHeader || req.protocol || "http";
    const host = req.get("host");
    return `${proto}://${host}`;
}

function makeAbsoluteLogoUrl(raw, req) {
    if (!raw) return null;
    let url = String(raw).trim();
    if (!url) return null;

    if (url.startsWith("/logos/")) {
        url = `/uploads/logos/${url.replace(/^\/?logos\//, "")}`;
    } else if (url.startsWith("logos/")) {
        url = `/uploads/logos/${url.replace(/^logos\//, "")}`;
    }

    if (url.startsWith("/uploads/logos/") || url.startsWith("/uploads/images/") || url.startsWith("/uploads/")) {
        return `${getBaseUrl(req)}${url}`;
    }

    try {
        if (/^https?:\/\//i.test(url)) {
            return url;
        }
    } catch {
        // ignore malformed URL
    }

    if (!url.startsWith("/")) url = `/${url}`;
    return `${getBaseUrl(req)}${url}`;
}

async function handleLogoUpload(logo, { restaurantId, restaurantName }) {
    if (!logo || typeof logo !== "string") return null;
    const trimmed = logo.trim();
    if (!trimmed) return null;

    if (!trimmed.startsWith("data:image/")) {
        return trimmed;
    }

    const match = trimmed.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
        const err = new Error("Invalid image data");
        err.statusCode = 400;
        throw err;
    }

    const mime = match[1];
    const data = match[2];
    const ext =
        mime === "image/png"
            ? "png"
            : mime === "image/jpeg"
                ? "jpg"
                : mime === "image/webp"
                    ? "webp"
                    : null;
    if (!ext) {
        const err = new Error("Unsupported image type");
        err.statusCode = 400;
        throw err;
    }

    const buffer = Buffer.from(data, "base64");
    let uploadedUrl = null;
    try {
        uploadedUrl = await uploadRestaurantLogo({
            buffer,
            contentType: mime,
            extension: ext,
        });
    } catch (storageErr) {
        console.error("[storage] restaurant logo upload failed, falling back to disk", storageErr);
    }

    if (uploadedUrl) return uploadedUrl;

    await fsp.mkdir(LOGO_UPLOAD_DIR, { recursive: true });
    const safeId = Number.isFinite(Number(restaurantId)) ? Number(restaurantId) : Date.now();
    const slug = (restaurantName || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const baseName = slug || `restaurant-${safeId}`;
    const fileName = `${baseName}-${Date.now()}.${ext}`;
    const filePath = path.join(LOGO_UPLOAD_DIR, fileName);
    await fsp.writeFile(filePath, buffer);
    return `/uploads/logos/${fileName}`;
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

function mapRestaurant(row, req) {
    if (!row) return null;
    return {
        id: Number(row.id),
        name: row.name || null,
        is_active: !!row.is_active,
        logo_url: makeAbsoluteLogoUrl(row.logo_url, req),
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
            SELECT id, name, is_active, logo_url
              FROM restaurants
             WHERE id = $1
             LIMIT 1
        `,
            [restaurantId]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        return res.json({ restaurant: mapRestaurant(rows[0], req) });
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
            RETURNING id, name, is_active, logo_url
        `,
            [isActive, restaurantId]
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        return res.json({ restaurant: mapRestaurant(rows[0], req) });
    } catch (err) {
        console.error("PATCH /restaurants/admin/status error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.patch("/admin/logo", requireAdmin, async (req, res) => {
    const restaurantId = req.admin.restaurantId;
    const rawLogo =
        req.body?.logo ??
        req.body?.logoUrl ??
        req.body?.logo_url ??
        null;
    const removeFlag = toBool(req.body?.remove, false);

    try {
        if (removeFlag || rawLogo == null || rawLogo === "") {
            const { rows } = await pool.query(
                `
                UPDATE restaurants
                   SET logo_url = NULL
                 WHERE id = $1
                RETURNING id, name, is_active, logo_url
            `,
                [restaurantId]
            );
            if (!rows.length) {
                return res.status(404).json({ error: "Restaurant not found" });
            }
            return res.json({ restaurant: mapRestaurant(rows[0], req) });
        }

        if (typeof rawLogo !== "string") {
            return res.status(400).json({ error: "Invalid logo value" });
        }

        const { rows: restaurantRows } = await pool.query(
            `
            SELECT id, name
              FROM restaurants
             WHERE id = $1
             LIMIT 1
        `,
            [restaurantId]
        );
        if (!restaurantRows.length) {
            return res.status(404).json({ error: "Restaurant not found" });
        }
        const restaurant = restaurantRows[0];

        const nextLogo = await handleLogoUpload(rawLogo, {
            restaurantId,
            restaurantName: restaurant.name,
        });

        const { rows } = await pool.query(
            `
            UPDATE restaurants
               SET logo_url = $1
             WHERE id = $2
            RETURNING id, name, is_active, logo_url
        `,
            [nextLogo, restaurantId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "Restaurant not found" });
        }

        return res.json({ restaurant: mapRestaurant(rows[0], req) });
    } catch (err) {
        const status = err?.statusCode || (err?.message && /invalid|unsupported image/i.test(err.message) ? 400 : 500);
        if (status >= 500) {
            console.error("PATCH /restaurants/admin/logo error:", err);
        }
        const message =
            err?.statusCode === 400 || status === 400
                ? err.message || "Invalid image data"
                : "Server error";
        return res.status(status).json({ error: message });
    }
});

module.exports = router;
