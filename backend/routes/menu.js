const express = require("express");
const router = express.Router();
const pool = require("../db");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";

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
            const imagesDir = path.resolve(__dirname, "../../frontend/public/images");
            const filePath = path.join(imagesDir, fileName);
            await fs.promises.mkdir(imagesDir, { recursive: true });
            await fs.promises.writeFile(filePath, Buffer.from(b64, "base64"));
            imageUrl = `/images/${fileName}`;
        }

        const insertSql =
            "INSERT INTO menu_items (name, price, category, image_url) VALUES ($1, $2, $3, $4) RETURNING *";
        const params = [name, priceNum, cat, imageUrl];

        const { rows } = await pool.query(insertSql, params);
        return res.json({ success: true, item: rows[0] });
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
            const imagesDir = path.resolve(__dirname, "../../frontend/public/images");
            const filePath = path.join(imagesDir, fileName);
            await fs.promises.mkdir(imagesDir, { recursive: true });
            await fs.promises.writeFile(filePath, Buffer.from(b64, "base64"));
            const newUrl = `/images/${fileName}`;

            // Try to remove old image if it was in our images folder and name changed
            if (existing.image_url && existing.image_url.startsWith("/images/")) {
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
        return res.json({ success: true, item: rows[0] });
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
        if (existing.image_url && existing.image_url.startsWith("/images/")) {
            const imagesDir = path.resolve(__dirname, "../../frontend/public/images");
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
