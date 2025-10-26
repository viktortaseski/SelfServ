// migrations.js
const pool = require("./db");

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

async function runMigrations() {
    await ensureRestaurantPrinterTable();
    await addClaimedByWorkerColumn();
    await addPrinterIdColumn();
    await ensureRestaurantIsActiveColumn();
    await ensureRestaurantLogoColumn();
    await ensureRestaurantCategoryImageColumn();
}

module.exports = {
    runMigrations,
};
