// migrations.js
const pool = require("./db");
const { DEFAULT_RESTAURANT_ID } = require("./config");

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

async function ensureOrderCreatedByRoleType() {
    try {
        await pool.query(
            `CREATE TYPE order_created_by_role AS ENUM ('customer', 'staff', 'admin')`
        );
    } catch (err) {
        if (err.code !== "42710") { // duplicate_object
            throw err;
        }
    }
    await ensureOrderCreatedByRoleEnumValues();
}

async function ensureBaseTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurants (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT,
            radius INT,
            address TEXT,
            phone_number TEXT,
            tax_id TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            logo_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS employees (
            id BIGSERIAL PRIMARY KEY,
            restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            last_login TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_restaurant_username
            ON employees (restaurant_id, username)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_tables (
              id BIGSERIAL PRIMARY KEY,
        restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        url TEXT,
        qr_code_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant
            ON restaurant_tables (restaurant_id)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS table_access_tokens (
            id BIGSERIAL PRIMARY KEY,
            token TEXT NOT NULL UNIQUE,
            table_id BIGINT NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
            expires_at TIMESTAMPTZ,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_table_access_tokens_table_id
            ON table_access_tokens (table_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_table_access_tokens_expires_used
            ON table_access_tokens (expires_at, used_at)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id BIGSERIAL PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_categories (
            id BIGSERIAL PRIMARY KEY,
            restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
            category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            img_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (restaurant_id, category_id)
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_restaurant_categories_restaurant
            ON restaurant_categories (restaurant_id)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_by_employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_products_active
            ON products (is_active)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_products (
            id BIGSERIAL PRIMARY KEY,
            restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
            product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            category_id BIGINT NOT NULL REFERENCES categories(id),
            price NUMERIC(10, 2) NOT NULL,
            img_url TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            sku TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (restaurant_id, product_id)
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_restaurant_products_restaurant
            ON restaurant_products (restaurant_id, is_active)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_restaurant_products_category
            ON restaurant_products (category_id)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id BIGSERIAL PRIMARY KEY,
            restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
            table_id BIGINT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
            total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
            tip NUMERIC(10, 2) NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'open',
            created_by_role order_created_by_role NOT NULL DEFAULT 'customer',
            print_payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS order_items (
            id BIGSERIAL PRIMARY KEY,
            order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            restaurant_product_id BIGINT NOT NULL REFERENCES restaurant_products(id),
            quantity INT NOT NULL,
            total_price NUMERIC(10, 2) NOT NULL,
            note TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await ensureRestaurantPrinterTable();

    await pool.query(`
        CREATE TABLE IF NOT EXISTS print_jobs (
            id BIGSERIAL PRIMARY KEY,
            order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            payload JSONB,
            status TEXT NOT NULL DEFAULT 'queued',
            printer_id BIGINT REFERENCES restaurant_printer(id) ON DELETE SET NULL,
            claimed_at TIMESTAMPTZ,
            claimed_by BIGINT,
            claimed_by_worker TEXT,
            finished_at TIMESTAMPTZ,
            last_error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
}

async function ensureDefaultRestaurant() {
    const defaultId = Number(DEFAULT_RESTAURANT_ID || 1) || 1;
    await pool.query(
        `
        INSERT INTO restaurants (id, name, is_active)
        VALUES ($1, 'Default Restaurant', TRUE)
        ON CONFLICT (id) DO NOTHING
    `,
        [defaultId]
    );

    try {
        await pool.query(
            `
            SELECT setval(
                pg_get_serial_sequence('restaurants', 'id'),
                GREATEST(
                    (SELECT COALESCE(MAX(id), 0) FROM restaurants),
                    $1
                )
            )
        `,
            [defaultId]
        );
    } catch (err) {
        console.warn("[migrations] unable to bump restaurants id sequence", err.message);
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
    await ensureOrderCreatedByRoleType();
    await ensureBaseTables();
    await ensureDefaultRestaurant();
    await addClaimedByWorkerColumn();
    await addPrinterIdColumn();
    await ensureRestaurantIsActiveColumn();
    await ensureRestaurantLogoColumn();
    await ensureRestaurantCategoryImageColumn();
    await ensureOrderPrintPayloadColumn();
    await ensurePerformanceIndexes();
}

module.exports = {
    runMigrations,
};
