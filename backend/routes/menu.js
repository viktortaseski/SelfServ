const express = require("express");
const router = express.Router();
const pool = require("../db");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || null;

function readBearer(req) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return null;
    return auth.slice(7);
}

function requireAdmin(req, res, next) {
    try {
        const token = readBearer(req);
        if (!token) return res.status(401).json({ error: "Not logged in" });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== "admin") return res.status(403).json({ error: "Forbidden" });
        req.user = decoded;
        return next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
}

function slugify(str) {
    return (str || "")
        .toString()
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase();
}

function getBaseUrl(req) {
    if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, "");
    const protoHeader = (req.headers['x-forwarded-proto'] || "").split(',')[0];
    const proto = protoHeader || req.protocol || "http";
    const host = req.get("host");
    return `${proto}://${host}`;
}

function makeAbsoluteImageUrl(raw, req) {
    if (!raw) return null;
    let url = String(raw).trim();
    if (!url) return null;

    if (url.startsWith("/images/")) {
        url = `/uploads/images/${url.replace(/^\/images\//, "")}`;
    } else if (url.startsWith("images/")) {
        url = `/uploads/images/${url.replace(/^images\//, "")}`;
    }

    try {
        if (/^https?:\/\//i.test(url)) {
            const parsed = new URL(url);
            const base = getBaseUrl(req);
            try {
                const baseParsed = new URL(base);
                if (parsed.origin !== baseParsed.origin && parsed.pathname) {
                    return `${baseParsed.origin}${parsed.pathname}`;
                }
            } catch {
                return url;
            }
            return url;
        }
    } catch {
        // ignore malformed URL, continue to treat as relative
    }

    if (!url.startsWith("/")) url = `/${url}`;
    return `${getBaseUrl(req)}${url}`;
}

function mapImageUrls(rows = [], req) {
    return rows.map((row) => ({
        ...row,
        image_url: makeAbsoluteImageUrl(row?.image_url, req),
    }));
}

router.get("/", async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const minPriceRaw = req.query.minPrice;
        const maxPriceRaw = req.query.maxPrice;
        const minPrice = minPriceRaw != null ? Number(minPriceRaw) : null;
        const maxPrice = maxPriceRaw != null ? Number(maxPriceRaw) : null;

        const where = [];
        const params = [];
        let idx = 1;

        if (search) {
            where.push(`LOWER(mi.name) LIKE LOWER($${idx++})`);
            params.push(`%${search}%`);
        }
        if (category) {
            where.push(`mi.category = $${idx++}`);
            params.push(category);
        }
        if (Number.isFinite(minPrice)) {
            where.push(`mi.price >= $${idx++}`);
            params.push(minPrice);
        }
        if (Number.isFinite(maxPrice)) {
            where.push(`mi.price <= $${idx++}`);
            params.push(maxPrice);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const sql = `
            SELECT mi.*
            FROM menu m
            JOIN menu_items mi ON mi.id = m.menu_item_id
            ${whereSql}
            ORDER BY m.added_at ASC, mi.id ASC
        `;

        const { rows } = await pool.query(sql, params);
        res.json(mapImageUrls(rows, req));
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
    FROM menu m
    JOIN menu_items mi ON mi.id = m.menu_item_id
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
        res.json(mapImageUrls(rows, req));
    } catch (err) {
        console.error("GET /api/menu/top-picks error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/admin", requireAdmin, async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const minPriceRaw = req.query.minPrice;
        const maxPriceRaw = req.query.maxPrice;
        const minPrice = minPriceRaw != null ? Number(minPriceRaw) : null;
        const maxPrice = maxPriceRaw != null ? Number(maxPriceRaw) : null;

        const where = [];
        const params = [];
        let idx = 1;

        if (search) {
            where.push(`LOWER(mi.name) LIKE LOWER($${idx++})`);
            params.push(`%${search}%`);
        }
        if (category) {
            where.push(`mi.category = $${idx++}`);
            params.push(category);
        }
        if (Number.isFinite(minPrice)) {
            where.push(`mi.price >= $${idx++}`);
            params.push(minPrice);
        }
        if (Number.isFinite(maxPrice)) {
            where.push(`mi.price <= $${idx++}`);
            params.push(maxPrice);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const sql = `
            SELECT
                mi.*,
                (m.menu_item_id IS NOT NULL) AS is_on_menu,
                m.added_at
            FROM menu_items mi
            LEFT JOIN menu m ON m.menu_item_id = mi.id
            ${whereSql}
            ORDER BY mi.id ASC
        `;

        const { rows } = await pool.query(sql, params);
        res.json(mapImageUrls(rows, req));
    } catch (err) {
        console.error("GET /api/menu/admin error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/:id/menu", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }

    try {
        const { rowCount } = await pool.query("SELECT 1 FROM menu_items WHERE id = $1", [id]);
        if (!rowCount) return res.status(404).json({ error: "Not found" });

        await pool.query(
            "INSERT INTO menu (menu_item_id, added_at) VALUES ($1, NOW()) ON CONFLICT (menu_item_id) DO NOTHING",
            [id]
        );

        const { rows } = await pool.query(
            `SELECT mi.*, (m.menu_item_id IS NOT NULL) AS is_on_menu
             FROM menu_items mi
             LEFT JOIN menu m ON m.menu_item_id = mi.id
             WHERE mi.id = $1`,
            [id]
        );

        const mapped = mapImageUrls(rows, req);
        return res.json({ success: true, item: mapped[0] });
    } catch (err) {
        console.error("POST /api/menu/:id/menu error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.delete("/:id/menu", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }

    try {
        const { rowCount } = await pool.query("SELECT 1 FROM menu_items WHERE id = $1", [id]);
        if (!rowCount) return res.status(404).json({ error: "Not found" });

        await pool.query("DELETE FROM menu WHERE menu_item_id = $1", [id]);

        return res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/menu/:id/menu error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Admin: create menu item (JSON, optional base64 image)
router.post("/", requireAdmin, async (req, res) => {
    try {
        const { name, price, category = "other", image } = req.body || {};

        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: "Name is required" });
        }
        const priceNum = Number(price);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
            return res.status(400).json({ error: "Price must be a positive number" });
        }
        const cat = String(category || "other").trim() || "other";

        let imageUrl = null;
        if (image && typeof image === "string" && image.startsWith("data:image/")) {
            // image is a data URL: data:image/png;base64,XXXXX
            const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (!match) {
                return res.status(400).json({ error: "Invalid image data" });
            }
            const mime = match[1];
            const b64 = match[2];
            const ext =
                mime === "image/png" ? "png" :
                mime === "image/jpeg" ? "jpg" :
                mime === "image/webp" ? "webp" : null;
            if (!ext) return res.status(400).json({ error: "Unsupported image type" });

            const baseName = slugify(name);
            const fileName = `${baseName}.${ext}`;
            const imagesDir = path.resolve(__dirname, "../uploads/images");
            const filePath = path.join(imagesDir, fileName);
            await fs.promises.mkdir(imagesDir, { recursive: true });
            await fs.promises.writeFile(filePath, Buffer.from(b64, "base64"));
            imageUrl = `/uploads/images/${fileName}`;
        }

        const insertSql =
            "INSERT INTO menu_items (name, price, category, image_url) VALUES ($1, $2, $3, $4) RETURNING *";
        const params = [name, priceNum, cat, imageUrl];

        const { rows } = await pool.query(insertSql, params);

        if (rows[0]?.id) {
            try {
                await pool.query("INSERT INTO menu (menu_item_id, added_at) VALUES ($1, NOW()) ON CONFLICT (menu_item_id) DO NOTHING", [rows[0].id]);
            } catch (err) {
                console.warn("Failed to auto-add new item to menu:", err.message);
            }
        }

        const mapped = mapImageUrls(rows, req);
        return res.json({ success: true, item: mapped[0] });
    } catch (err) {
        if (err && err.code === "23505") {
            return res.status(400).json({ error: "Name already exists" });
        }
        console.error("POST /api/menu error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Admin: update menu item
router.put("/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }
    try {
        const { name, price, category, image } = req.body || {};

        const { rows: existingRows } = await pool.query("SELECT * FROM menu_items WHERE id = $1", [id]);
        if (!existingRows.length) return res.status(404).json({ error: "Not found" });
        const existing = existingRows[0];

        const updates = {
            name: name != null ? String(name) : existing.name,
            price: price != null ? Number(price) : Number(existing.price),
            category: category != null ? String(category) : existing.category,
            image_url: existing.image_url,
        };

        if (!updates.name.trim()) return res.status(400).json({ error: "Name is required" });
        if (!Number.isFinite(updates.price) || updates.price <= 0) {
            return res.status(400).json({ error: "Price must be a positive number" });
        }
        updates.category = updates.category.trim() || "other";

        // If new image provided, save it and update image_url; delete old one best-effort
        if (image && typeof image === "string" && image.startsWith("data:image/")) {
            const match = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (!match) return res.status(400).json({ error: "Invalid image data" });
            const mime = match[1];
            const b64 = match[2];
            const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : null;
            if (!ext) return res.status(400).json({ error: "Unsupported image type" });

            const baseName = slugify(updates.name);
            const fileName = `${baseName}.${ext}`;
            const imagesDir = path.resolve(__dirname, "../uploads/images");
            const filePath = path.join(imagesDir, fileName);
            await fs.promises.mkdir(imagesDir, { recursive: true });
            await fs.promises.writeFile(filePath, Buffer.from(b64, "base64"));
            const newUrl = `/uploads/images/${fileName}`;

            // Try to remove old image if it was in our images folder and name changed
            if (existing.image_url && existing.image_url.includes("/uploads/images/")) {
                const oldPath = path.join(imagesDir, path.basename(existing.image_url));
                if (oldPath !== filePath) {
                    try { await fs.promises.unlink(oldPath); } catch {}
                }
            }
            updates.image_url = newUrl;
        }

        const { rows } = await pool.query(
            "UPDATE menu_items SET name = $1, price = $2, category = $3, image_url = $4 WHERE id = $5 RETURNING *",
            [updates.name, updates.price, updates.category, updates.image_url, id]
        );
        const mapped = mapImageUrls(rows, req);
        return res.json({ success: true, item: mapped[0] });
    } catch (err) {
        if (err && err.code === "23505") {
            return res.status(400).json({ error: "Name already exists" });
        }
        console.error("PUT /api/menu/:id error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Admin: delete menu item
router.delete("/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }
    try {
        const { rows: existingRows } = await pool.query("SELECT * FROM menu_items WHERE id = $1", [id]);
        if (!existingRows.length) return res.status(404).json({ error: "Not found" });
        const existing = existingRows[0];

        await pool.query("DELETE FROM menu_items WHERE id = $1", [id]);

        // Best-effort delete of image file if in our images dir
        if (existing.image_url && existing.image_url.includes("/uploads/images/")) {
            const imagesDir = path.resolve(__dirname, "../uploads/images");
            const oldPath = path.join(imagesDir, path.basename(existing.image_url));
            try { await fs.promises.unlink(oldPath); } catch {}
        }

        return res.json({ success: true });
    } catch (err) {
        if (err && err.code === "23503") {
            return res.status(400).json({ error: "Item is referenced by orders and cannot be deleted" });
        }
        console.error("DELETE /api/menu/:id error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
