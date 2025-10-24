// routes/users.js
const express = require("express");
const pool = require("../db");
const jwt = require("jsonwebtoken");
const { DEFAULT_RESTAURANT_ID } = require("../config");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const ALLOWED_ROLES = ["admin", "staff"];

// Helper: parse Bearer token
function readBearer(req) {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return null;
    return auth.slice(7);
}

function normalizeRole(raw) {
    if (!raw) return null;
    const role = String(raw).toLowerCase();
    return ALLOWED_ROLES.includes(role) ? role : null;
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
        console.error("requireAdmin error:", err);
        return res.status(500).json({ error: "Server error" });
    }
}

router.post("/register", async (req, res) => {
    try {
        const {
            username,
            password,
            role,
            restaurantId = DEFAULT_RESTAURANT_ID,
        } = req.body || {};

        const trimmedUsername = String(username || "").trim();
        const trimmedPassword = String(password || "").trim();

        if (!trimmedUsername || !trimmedPassword) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const normalizedRole = normalizeRole(role);
        if (!normalizedRole) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const restaurantIdNum = Number(restaurantId) || DEFAULT_RESTAURANT_ID;

        const result = await pool.query(
            `
            INSERT INTO employees (restaurant_id, role, username, password)
            VALUES ($1, $2, $3, $4)
            RETURNING id, restaurant_id, role, username
        `,
            [restaurantIdNum, normalizedRole, trimmedUsername, trimmedPassword]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Login (NO SESSIONS) -> returns JWT
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query(
            `
            SELECT e.*, r.name AS restaurant_name
            FROM employees e
            LEFT JOIN restaurants r ON r.id = e.restaurant_id
            WHERE e.username = $1
            LIMIT 1
        `,
            [username]
        );
        if (!result.rows.length) return res.status(400).json({ error: "User not found" });

        const user = result.rows[0];
        if (!user.is_active) {
            return res.status(403).json({ error: "Account disabled" });
        }
        if (password !== user.password) {
            return res.status(400).json({ error: "Invalid password" });
        }

        const payload = {
            id: user.id,
            role: user.role,
            username: user.username,
            restaurant_id: user.restaurant_id,
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        try {
            await pool.query(
                `
                UPDATE employees
                   SET last_login = NOW()
                 WHERE id = $1
            `,
                [user.id]
            );
        } catch (err) {
            console.warn("[users/login] failed to update last_login", err.message);
        }

        return res.json({
            success: true,
            token,
            role: user.role,
            username: user.username,
            restaurant_id: user.restaurant_id,
            restaurant_name: user.restaurant_name || null,
        });
    } catch (err) {
        console.error("💥 Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// Me (NO SESSIONS) -> verifies JWT from Authorization header
router.get("/me", async (req, res) => {
    try {
        const token = readBearer(req);
        if (!token) return res.status(401).json({ error: "Not logged in" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const { rows } = await pool.query(
            `
            SELECT
                e.id,
                e.username,
                e.role,
                e.restaurant_id,
                r.name AS restaurant_name
            FROM employees e
            LEFT JOIN restaurants r ON r.id = e.restaurant_id
            WHERE e.id = $1
            LIMIT 1
        `,
            [decoded.id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = rows[0];
        return res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            restaurant_id: user.restaurant_id,
            restaurant_name: user.restaurant_name || null,
        });
    } catch (err) {
        if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Invalid token" });
        }
        console.error("GET /users/me error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Logout is a no-op without sessions; client just drops the token
router.post("/logout", (_req, res) => {
    res.json({ success: true });
});

function mapEmployeeRow(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        restaurant_id: Number(row.restaurant_id),
        username: row.username,
        role: row.role,
        is_active: !!row.is_active,
        last_login: row.last_login ? new Date(row.last_login).toISOString() : null,
    };
}

router.get("/admin/employees", requireAdmin, async (req, res) => {
    try {
        const restaurantId = req.admin.restaurantId;
        const { rows } = await pool.query(
            `
            SELECT id, restaurant_id, username, role, is_active, last_login
              FROM employees
             WHERE restaurant_id = $1
             ORDER BY username ASC
        `,
            [restaurantId]
        );
        return res.json({
            employees: rows.map(mapEmployeeRow),
        });
    } catch (err) {
        console.error("GET /users/admin/employees error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.post("/admin/employees", requireAdmin, async (req, res) => {
    const restaurantId = req.admin.restaurantId;
    const {
        username,
        password,
        role = "staff",
        isActive = true,
    } = req.body || {};

    const trimmedUsername = String(username || "").trim();
    const trimmedPassword = String(password || "").trim();
    const normalizedRole = normalizeRole(role) || "staff";
    const isActiveBool = toBool(isActive, true);

    if (!trimmedUsername || trimmedUsername.length < 3) {
        return res.status(400).json({ error: "Username must be at least 3 characters" });
    }
    if (!trimmedPassword || trimmedPassword.length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
    }
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
        return res.status(400).json({ error: "Invalid role" });
    }

    try {
        const { rows } = await pool.query(
            `
            INSERT INTO employees (restaurant_id, role, username, password, is_active)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, restaurant_id, username, role, is_active, last_login
        `,
            [restaurantId, normalizedRole, trimmedUsername, trimmedPassword, isActiveBool]
        );
        return res.status(201).json({ employee: mapEmployeeRow(rows[0]) });
    } catch (err) {
        if (err?.code === "23505") {
            return res.status(409).json({ error: "Username already exists for this restaurant" });
        }
        console.error("POST /users/admin/employees error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.patch("/admin/employees/:id", requireAdmin, async (req, res) => {
    const restaurantId = req.admin.restaurantId;
    const adminId = req.admin.id;
    const targetId = Number(req.params.id);
    if (!Number.isFinite(targetId) || targetId <= 0) {
        return res.status(400).json({ error: "Invalid employee id" });
    }

    const roleRaw = req.body?.role;
    const passwordRaw = req.body?.password;
    const isActiveRaw = req.body?.isActive ?? req.body?.is_active;

    const updates = [];
    const values = [];

    if (roleRaw !== undefined) {
        const normalizedRole = normalizeRole(roleRaw);
        if (!normalizedRole) {
            return res.status(400).json({ error: "Invalid role" });
        }
        if (targetId === adminId && normalizedRole !== "admin") {
            return res.status(400).json({ error: "You cannot change your own role" });
        }
        values.push(normalizedRole);
        updates.push(`role = $${values.length}`);
    }

    if (isActiveRaw !== undefined) {
        const isActiveBool = toBool(isActiveRaw, null);
        if (isActiveBool == null) {
            return res.status(400).json({ error: "Invalid isActive value" });
        }
        if (targetId === adminId && !isActiveBool) {
            return res.status(400).json({ error: "You cannot deactivate your own account" });
        }
        values.push(isActiveBool);
        updates.push(`is_active = $${values.length}`);
    }

    if (passwordRaw !== undefined) {
        const trimmedPassword = String(passwordRaw || "").trim();
        if (!trimmedPassword || trimmedPassword.length < 4) {
            return res.status(400).json({ error: "Password must be at least 4 characters" });
        }
        values.push(trimmedPassword);
        updates.push(`password = $${values.length}`);
    }

    if (!updates.length) {
        return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(targetId);
    const idIdx = values.length;
    values.push(restaurantId);
    const restIdx = values.length;

    try {
        const { rows } = await pool.query(
            `
            UPDATE employees
               SET ${updates.join(", ")}
             WHERE id = $${idIdx}
               AND restaurant_id = $${restIdx}
            RETURNING id, restaurant_id, username, role, is_active, last_login
        `,
            values
        );
        if (!rows.length) {
            return res.status(404).json({ error: "Employee not found" });
        }
        return res.json({ employee: mapEmployeeRow(rows[0]) });
    } catch (err) {
        console.error("PATCH /users/admin/employees/:id error:", err);
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
