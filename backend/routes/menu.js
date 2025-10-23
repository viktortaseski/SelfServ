const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { uploadMenuImage } = require("../services/storage");
const { DEFAULT_RESTAURANT_ID } = require("../config");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || null;
const MENU_IMAGES_DIR = path.resolve(__dirname, "../uploads/images");
const fsp = fs.promises;

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

function humanizeSlug(slug) {
    if (!slug) return "";
    return slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function pickRestaurantId(req) {
    const fromUser = Number(req?.user?.restaurant_id);
    if (Number.isFinite(fromUser) && fromUser > 0) return fromUser;

    const fromQuery = Number(req?.query?.restaurantId);
    if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery;

    return DEFAULT_RESTAURANT_ID;
}

function getBaseUrl(req) {
    if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, "");
    const protoHeader = (req.headers["x-forwarded-proto"] || "").split(",")[0];
    const proto = protoHeader || req.protocol || "http";
    const host = req.get("host");
    return `${proto}://${host}`;
}

function makeAbsoluteImageUrl(raw, req) {
    if (!raw) return null;
    let url = String(raw).trim();
    if (!url) return null;

    if (url.startsWith("/images/")) {
        url = `/uploads/images/${url.replace(/^\/?images\//, "")}`;
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

function formatMenuRow(row, req) {
    if (!row) return null;
    const rawPrice = row.price != null ? Number(row.price) : null;
    const price = Number.isFinite(rawPrice) ? rawPrice : null;
    const rawImage = row.img_url ?? row.image_url ?? null;
    const imageUrl = makeAbsoluteImageUrl(rawImage, req);
    return {
        id: row.id,
        restaurant_id: row.restaurant_id,
        product_id: row.product_id,
        category_id: row.category_id,
        name: row.name,
        description: row.description,
        price,
        category: row.category,
        category_name: row.category_name,
        is_active: row.is_active,
        is_on_menu: row.is_on_menu ?? row.is_active,
        sku: row.sku,
        image_url: imageUrl,
        img_url: imageUrl,
        raw_image_url: rawImage,
    };
}

async function fetchMenuItemById(db, restaurantId, id) {
    const { rows } = await db.query(
        `
        SELECT
            rp.id,
            rp.restaurant_id,
            rp.product_id,
            rp.category_id,
            rp.price,
            rp.img_url,
            rp.is_active,
            rp.sku,
            p.name,
            p.description,
            c.slug AS category,
            c.name AS category_name
        FROM restaurant_products rp
        JOIN products p ON p.id = rp.product_id
        JOIN categories c ON c.id = rp.category_id
        WHERE rp.id = $1
          AND rp.restaurant_id = $2
    `,
        [id, restaurantId]
    );
    return rows[0] || null;
}

async function getCategoryId(client, restaurantId, categoryInput, employeeId) {
    const slug = slugify(categoryInput || "other") || "other";
    const { rows: existing } = await client.query(
        "SELECT id FROM categories WHERE slug = $1",
        [slug]
    );

    let categoryId = existing[0]?.id || null;

    if (!categoryId) {
        const { rows } = await client.query(
            `
            INSERT INTO categories (slug, name, created_by_employee_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (slug) DO NOTHING
            RETURNING id
        `,
            [slug, humanizeSlug(slug) || slug, employeeId || null]
        );
        if (rows[0]?.id) {
            categoryId = rows[0].id;
        } else {
            const { rows: reFetch } = await client.query(
                "SELECT id FROM categories WHERE slug = $1",
                [slug]
            );
            categoryId = reFetch[0]?.id || null;
        }
    }

    if (!categoryId) {
        throw new Error("Unable to resolve category");
    }

    try {
        await client.query(
            `
            INSERT INTO restaurant_categories (restaurant_id, category_id)
            VALUES ($1, $2)
            ON CONFLICT (restaurant_id, category_id) DO NOTHING
        `,
            [restaurantId, categoryId]
        );
    } catch (err) {
        if (err.code === "P0001") {
            throw new Error("Restaurant already has maximum categories assigned");
        }
        throw err;
    }

    return { categoryId, slug };
}

async function handleImageUpload(image, name) {
    if (!image || typeof image !== "string") return null;
    const trimmed = image.trim();
    if (!trimmed) return null;

    if (!trimmed.startsWith("data:image/")) {
        return trimmed;
    }

    const match = trimmed.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid image data");
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
    if (!ext) throw new Error("Unsupported image type");

    const buffer = Buffer.from(data, "base64");
    let uploadedUrl = null;
    try {
        uploadedUrl = await uploadMenuImage({
            buffer,
            contentType: mime,
            extension: ext,
        });
    } catch (storageErr) {
        console.error("[storage] upload failed, falling back to disk", storageErr);
    }

    if (uploadedUrl) return uploadedUrl;

    await fsp.mkdir(MENU_IMAGES_DIR, { recursive: true });
    const baseName = slugify(name) || `item-${Date.now()}`;
    const fileName = `${baseName}-${Date.now()}.${ext}`;
    const filePath = path.join(MENU_IMAGES_DIR, fileName);
    await fsp.writeFile(filePath, buffer);
    return `/uploads/images/${fileName}`;
}

function parsePrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
}

router.get("/", async (req, res) => {
    try {
        const restaurantId = pickRestaurantId(req);
        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : null;

        const where = [
            "rp.restaurant_id = $1",
            "rp.is_active = TRUE",
            "p.is_active = TRUE",
            "c.is_active = TRUE",
        ];
        const params = [restaurantId];
        let idx = params.length;

        if (search) {
            where.push(`LOWER(p.name) LIKE LOWER($${++idx})`);
            params.push(`%${search}%`);
        }
        if (category) {
            where.push(`c.slug = $${++idx}`);
            params.push(category);
        }
        if (Number.isFinite(minPrice)) {
            where.push(`rp.price >= $${++idx}`);
            params.push(minPrice);
        }
        if (Number.isFinite(maxPrice)) {
            where.push(`rp.price <= $${++idx}`);
            params.push(maxPrice);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const { rows } = await pool.query(
            `
            SELECT
                rp.id,
                rp.restaurant_id,
                rp.product_id,
                rp.category_id,
                rp.price,
                rp.img_url,
                rp.is_active,
                rp.sku,
                p.name,
                p.description,
                c.slug AS category,
                c.name AS category_name
            FROM restaurant_products rp
            JOIN products p ON p.id = rp.product_id
            JOIN categories c ON c.id = rp.category_id
            ${whereSql}
            ORDER BY c.slug ASC, p.name ASC
        `,
            params
        );

        res.json(rows.map((row) => formatMenuRow(row, req)));
    } catch (err) {
        console.error("GET /api/menu error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/top-picks", async (req, res) => {
    try {
        const restaurantId = pickRestaurantId(req);
        const category = (req.query.category || "").trim();
        const limit = Math.min(
            Math.max(parseInt(req.query.limit || "10", 10), 1),
            50
        );

        const params = [restaurantId];
        let idx = params.length;
        const filters = [
            "rp.restaurant_id = $1",
            "rp.is_active = TRUE",
            "p.is_active = TRUE",
            "c.is_active = TRUE",
        ];

        if (category) {
            filters.push(`c.slug = $${++idx}`);
            params.push(category);
        }

        params.push(limit);

        const { rows } = await pool.query(
            `
            SELECT
                rp.id,
                rp.restaurant_id,
                rp.product_id,
                rp.category_id,
                rp.price,
                rp.img_url,
                rp.is_active,
                rp.sku,
                p.name,
                p.description,
                c.slug AS category,
                c.name AS category_name,
                COALESCE(SUM(oi.quantity), 0)::bigint AS total_qty
            FROM restaurant_products rp
            JOIN products p ON p.id = rp.product_id
            JOIN categories c ON c.id = rp.category_id
            LEFT JOIN order_items oi ON oi.restaurant_product_id = rp.id
            LEFT JOIN orders o ON o.id = oi.order_id AND o.restaurant_id = rp.restaurant_id
            WHERE ${filters.join(" AND ")}
            GROUP BY rp.id, p.name, p.description, c.slug, c.name
            ORDER BY total_qty DESC NULLS LAST, p.name ASC
            LIMIT $${idx + 1}
        `,
            params
        );

        res.json(rows.map((row) => formatMenuRow(row, req)));
    } catch (err) {
        console.error("GET /api/menu/top-picks error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/categories", async (req, res) => {
    try {
        const restaurantId = pickRestaurantId(req);
        const { rows } = await pool.query(
            `
            SELECT
                c.id,
                c.slug,
                c.name,
                rc.created_at
            FROM restaurant_categories rc
            JOIN categories c ON c.id = rc.category_id
            WHERE rc.restaurant_id = $1
              AND c.is_active = TRUE
            ORDER BY c.name ASC
        `,
            [restaurantId]
        );

        res.json(
            rows.map((row) => ({
                id: row.id,
                slug: row.slug,
                name: row.name,
                created_at:
                    row.created_at instanceof Date
                        ? row.created_at.toISOString()
                        : row.created_at,
            }))
        );
    } catch (err) {
        console.error("GET /api/menu/categories error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/admin", requireAdmin, async (req, res) => {
    try {
        const restaurantId = pickRestaurantId(req);
        const search = (req.query.search || "").trim();
        const category = (req.query.category || "").trim();
        const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : null;
        const includeInactive = String(req.query.includeInactive || "").toLowerCase() === "true";

        const where = ["rp.restaurant_id = $1"];
        const params = [restaurantId];
        let idx = params.length;

        if (!includeInactive) {
            where.push("rp.is_active = TRUE");
        }
        if (search) {
            where.push(`LOWER(p.name) LIKE LOWER($${++idx})`);
            params.push(`%${search}%`);
        }
        if (category) {
            where.push(`c.slug = $${++idx}`);
            params.push(category);
        }
        if (Number.isFinite(minPrice)) {
            where.push(`rp.price >= $${++idx}`);
            params.push(minPrice);
        }
        if (Number.isFinite(maxPrice)) {
            where.push(`rp.price <= $${++idx}`);
            params.push(maxPrice);
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
        const { rows } = await pool.query(
            `
            SELECT
                rp.id,
                rp.restaurant_id,
                rp.product_id,
                rp.category_id,
                rp.price,
                rp.img_url,
                rp.is_active,
                rp.sku,
                p.name,
                p.description,
                c.slug AS category,
                c.name AS category_name
            FROM restaurant_products rp
            JOIN products p ON p.id = rp.product_id
            JOIN categories c ON c.id = rp.category_id
            ${whereSql}
            ORDER BY rp.id DESC
        `,
            params
        );

        const mapped = rows.map((row) =>
            formatMenuRow(
                {
                    ...row,
                    is_on_menu: row.is_active,
                },
                req
            )
        );
        res.json(mapped);
    } catch (err) {
        console.error("GET /api/menu/admin error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/:id/menu", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }
    try {
        const restaurantId = pickRestaurantId(req);
        const { rowCount } = await pool.query(
            "UPDATE restaurant_products SET is_active = TRUE WHERE id = $1 AND restaurant_id = $2",
            [id, restaurantId]
        );
        if (!rowCount) return res.status(404).json({ error: "Not found" });

        const item = await fetchMenuItemById(pool, restaurantId, id);
        return res.json({ success: true, item: formatMenuRow(item, req) });
    } catch (err) {
        console.error("POST /api/menu/:id/menu error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.delete("/:id/menu", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }
    try {
        const restaurantId = pickRestaurantId(req);
        const { rowCount } = await pool.query(
            "UPDATE restaurant_products SET is_active = FALSE WHERE id = $1 AND restaurant_id = $2",
            [id, restaurantId]
        );
        if (!rowCount) return res.status(404).json({ error: "Not found" });
        return res.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/menu/:id/menu error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.post("/", requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const restaurantId = pickRestaurantId(req);
        const { name, price, category = "other", image, description = null, sku = null } = req.body || {};

        const trimmedName = String(name || "").trim();
        if (!trimmedName) {
            return res.status(400).json({ error: "Name is required" });
        }

        const priceNum = parsePrice(price);
        if (priceNum == null || priceNum <= 0) {
            return res.status(400).json({ error: "Price must be a positive number" });
        }

        await client.query("BEGIN");

        const { categoryId, slug } = await getCategoryId(
            client,
            restaurantId,
            category,
            req.user?.id || null
        );

        const imageUrl = await handleImageUpload(image, trimmedName);

        const { rows: productRows } = await client.query(
            `
            INSERT INTO products (name, description, created_by_employee_id)
            VALUES ($1, $2, $3)
            RETURNING id
        `,
            [trimmedName, description || null, req.user?.id || null]
        );
        const productId = productRows[0]?.id;
        if (!productId) {
            throw new Error("Failed to create product");
        }

        const { rows: rpRows } = await client.query(
            `
            INSERT INTO restaurant_products (
                restaurant_id,
                product_id,
                category_id,
                price,
                img_url,
                is_active,
                sku
            )
            VALUES ($1, $2, $3, $4, $5, TRUE, $6)
            RETURNING id
        `,
            [restaurantId, productId, categoryId, priceNum, imageUrl, sku || null]
        );
        const rpId = rpRows[0]?.id;
        if (!rpId) {
            throw new Error("Failed to create restaurant product");
        }

        await client.query("COMMIT");

        const item = await fetchMenuItemById(pool, restaurantId, rpId);
        const formatted = formatMenuRow(item, req);
        formatted.category = slug;
        return res.json({ success: true, item: formatted });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => { });
        if (err && err.code === "23505") {
            return res.status(400).json({ error: "Item already exists" });
        }
        if (err && typeof err.message === "string") {
            const lower = err.message.toLowerCase();
            if (
                lower.includes("image") ||
                lower.includes("category") ||
                lower.includes("product")
            ) {
                return res.status(400).json({ error: err.message });
            }
        }
        console.error("POST /api/menu error:", err);
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

router.put("/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }

    const client = await pool.connect();
    try {
        const restaurantId = pickRestaurantId(req);
        const { name, price, category, image, description, sku } = req.body || {};

        await client.query("BEGIN");
        const { rows: existingRows } = await client.query(
            `
            SELECT
                rp.id,
                rp.restaurant_id,
                rp.product_id,
                rp.category_id,
                rp.price,
                rp.img_url,
                rp.is_active,
                rp.sku,
                p.name AS product_name,
                p.description AS product_description,
                c.slug AS category_slug
            FROM restaurant_products rp
            JOIN products p ON p.id = rp.product_id
            JOIN categories c ON c.id = rp.category_id
            WHERE rp.id = $1
              AND rp.restaurant_id = $2
            FOR UPDATE
        `,
            [id, restaurantId]
        );

        if (!existingRows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Not found" });
        }

        const existing = existingRows[0];

        const updatedName =
            name != null ? String(name).trim() : String(existing.product_name || "").trim();
        if (!updatedName) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Name is required" });
        }

        const priceNum =
            price != null ? parsePrice(price) : parsePrice(existing.price);
        if (priceNum == null || priceNum <= 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Price must be a positive number" });
        }

        let targetCategoryId = existing.category_id;
        let targetCategorySlug = existing.category_slug;
        if (category != null && slugify(category) !== slugify(existing.category_slug)) {
            const { categoryId, slug } = await getCategoryId(
                client,
                restaurantId,
                category,
                req.user?.id || null
            );
            targetCategoryId = categoryId;
            targetCategorySlug = slug;
        }

        let imageUrl = existing.img_url;
        if (image !== undefined) {
            if (image === null || image === "") {
                imageUrl = null;
            } else {
                imageUrl = await handleImageUpload(image, updatedName);
            }
        }

        const nextSku =
            sku !== undefined ? (sku === null || sku === "" ? null : String(sku)) : existing.sku;

        await client.query(
            `
            UPDATE products
            SET name = $1,
                description = CASE WHEN $2 IS NULL THEN description ELSE $2 END
            WHERE id = $3
        `,
            [updatedName, description !== undefined ? description : existing.product_description, existing.product_id]
        );

        await client.query(
            `
            UPDATE restaurant_products
            SET price = $1,
                category_id = $2,
                img_url = $3,
                sku = $4
            WHERE id = $5
              AND restaurant_id = $6
        `,
            [priceNum, targetCategoryId, imageUrl, nextSku, id, restaurantId]
        );

        await client.query("COMMIT");

        const item = await fetchMenuItemById(pool, restaurantId, id);
        const formatted = formatMenuRow(item, req);
        formatted.category = targetCategorySlug;
        return res.json({ success: true, item: formatted });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => { });
        if (err && typeof err.message === "string") {
            const lower = err.message.toLowerCase();
            if (
                lower.includes("image") ||
                lower.includes("category") ||
                lower.includes("name") ||
                lower.includes("price")
            ) {
                return res.status(400).json({ error: err.message });
            }
        }
        console.error("PUT /api/menu/:id error:", err);
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

router.delete("/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id" });
    }

    const restaurantId = pickRestaurantId(req);

    try {
        const deleteRes = await pool.query(
            `
            DELETE FROM restaurant_products
            WHERE id = $1
              AND restaurant_id = $2
            RETURNING product_id
        `,
            [id, restaurantId]
        );

        if (!deleteRes.rowCount) {
            return res.status(404).json({ error: "Not found" });
        }

        const productId = deleteRes.rows[0]?.product_id;
        if (productId) {
            await pool.query(
                `
                DELETE FROM products
                WHERE id = $1
                  AND NOT EXISTS (
                      SELECT 1 FROM restaurant_products WHERE product_id = $1
                  )
            `,
                [productId]
            );
        }

        return res.json({ success: true, deleted: true });
    } catch (err) {
        if (err.code === "23503") {
            try {
                await pool.query(
                    `
                    UPDATE restaurant_products
                    SET is_active = FALSE
                    WHERE id = $1
                      AND restaurant_id = $2
                `,
                    [id, restaurantId]
                );
                const item = await fetchMenuItemById(pool, restaurantId, id);
                return res.json({
                    success: true,
                    deleted: false,
                    note: "Item has historical orders and was marked inactive instead.",
                    item: formatMenuRow(item, req),
                });
            } catch (fallbackErr) {
                console.error("DELETE fallback failed:", fallbackErr);
            }
        }
        console.error("DELETE /api/menu/:id error:", err);
        return res.status(500).json({ error: err.message || "Server error" });
    }
});

module.exports = router;
