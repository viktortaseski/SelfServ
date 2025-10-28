// migrations.js
const pool = require("./db");

async function ensureEnumHasValue(typeName, value) {
    if (!typeName || !value) return;
    const sanitizedType = typeName.replace(/[^a-zA-Z0-9_]/g, "");
    const sanitizedValue = value.replace(/'/g, "''");
    if (!sanitizedType || !sanitizedValue) return;

    try {
        await pool.query(
            `ALTER TYPE ${sanitizedType} ADD VALUE IF NOT EXISTS '${sanitizedValue}'`
        );
        return;
    } catch (err) {
        if (err.code === "42704") {
            console.warn(
                `[migrations] enum type ${sanitizedType} missing; skipping value ${value}`
            );
            return;
        }
        if (err.code !== "42601") {
            if (err.code === "42710") return; // duplicate value
            throw err;
        }
        // Fallback for older Postgres versions without IF NOT EXISTS support
        const { rows } = await pool.query(
            `SELECT 1
             FROM pg_enum
             WHERE enumlabel = $1
               AND enumtypid = (
                   SELECT oid FROM pg_type WHERE typname = $2
               )
             LIMIT 1`,
            [value, sanitizedType]
        );
        if (rows.length) return;
        try {
            await pool.query(`ALTER TYPE ${sanitizedType} ADD VALUE '${sanitizedValue}'`);
        } catch (err2) {
            if (err2.code === "42710") return;
            throw err2;
        }
    }
}

async function ensureOrderCreatedByRoleEnumValues() {
    await ensureEnumHasValue("order_created_by_role", "staff");
    await ensureEnumHasValue("order_created_by_role", "admin");
}

async function ensureRestaurantPrinterTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_printer (
            id BIGSERIAL PRIMARY KEY,
            restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            queue_name TEXT NOT NULL,
            api_base TEXT NOT NULL,
            api_token TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_printer_api_token
            ON restaurant_printer (api_token)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_restaurant_printer_restaurant_id
            ON restaurant_printer (restaurant_id)
    `);
}

async function addClaimedByWorkerColumn() {
    try {
        await pool.query(
            `
            ALTER TABLE print_jobs
                ADD COLUMN IF NOT EXISTS claimed_by_worker TEXT
            `
        );
    } catch (err) {
        if (err.code === "42P01") {
            console.warn(
                "[migrations] print_jobs table missing; skipping claimed_by_worker column"
            );
            return;
        }
        throw err;
    }
}

async function addPrinterIdColumn() {
    try {
        await pool.query(
            `
            ALTER TABLE print_jobs
                ADD COLUMN IF NOT EXISTS printer_id BIGINT
            `
        );
    } catch (err) {
        if (err.code === "42P01") {
            console.warn(
                "[migrations] print_jobs table missing; skipping printer_id column"
            );
            return;
        }
        throw err;
    }
}

async function ensureRestaurantIsActiveColumn() {
    try {
        await pool.query(`
            ALTER TABLE restaurants
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
        `);
    } catch (err) {
        if (err.code === "42P01") {
            console.warn("[migrations] restaurants table missing; skipping is_active column");
            return;
        }
        throw err;
    }
}

async function ensureRestaurantLogoColumn() {
    try {
        await pool.query(`
            ALTER TABLE restaurants
            ADD COLUMN IF NOT EXISTS logo_url TEXT
        `);
    } catch (err) {
        if (err.code === "42P01") {
            console.warn("[migrations] restaurants table missing; skipping logo_url column");
            return;
        }
        throw err;
    }
}

async function ensureRestaurantCategoryImageColumn() {
    try {
        await pool.query(`
            ALTER TABLE restaurant_categories
            ADD COLUMN IF NOT EXISTS img_url TEXT
        `);
    } catch (err) {
        if (err.code === "42P01") {
            console.warn("[migrations] restaurant_categories table missing; skipping img_url column");
            return;
        }
        throw err;
    }
}

async function ensureOrderPrintPayloadColumn() {
    try {
        await pool.query(`
            ALTER TABLE orders
            ADD COLUMN IF NOT EXISTS print_payload JSONB
        `);
    } catch (err) {
        if (err.code === "42P01") {
            console.warn("[migrations] orders table missing; skipping print_payload column");
            return;
        }
        throw err;
    }
}

async function ensurePerformanceIndexes() {
    const statements = [
        `
        CREATE INDEX IF NOT EXISTS idx_print_jobs_status_printer
            ON print_jobs (status, printer_id, id)
            WHERE status = 'queued'
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_print_jobs_order_id
            ON print_jobs (order_id)
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
            ON orders (restaurant_id, status, id)
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_orders_table_status_open
            ON orders (table_id, status)
            WHERE status = 'open'
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id
            ON order_items (order_id)
        `,
        `
        CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at
            ON print_jobs (created_at)
        `,
    ];

    for (const sql of statements) {
        try {
            await pool.query(sql);
        } catch (err) {
            if (err.code === "42P01" || err.code === "42703") {
                console.warn("[migrations] skipping index creation; table missing for statement:", sql.trim().split("\n")[0]);
                continue;
            }
            throw err;
        }
    }
}

async function runMigrations() {
    await ensureRestaurantPrinterTable();
    await addClaimedByWorkerColumn();
    await addPrinterIdColumn();
    await ensureRestaurantIsActiveColumn();
    await ensureRestaurantLogoColumn();
    await ensureRestaurantCategoryImageColumn();
    await ensureOrderCreatedByRoleEnumValues();
    await ensureOrderPrintPayloadColumn();
    await ensurePerformanceIndexes();
}

module.exports = {
    runMigrations,
};
