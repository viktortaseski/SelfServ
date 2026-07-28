// seeds.js — idempotent seed data (users, categories, products + images)
// Images live in ./uploads/images and are served at /uploads/images/<file>.
const pool = require("./db");
const { DEFAULT_RESTAURANT_ID } = require("./config");

const RESTAURANT_ID = Number(DEFAULT_RESTAURANT_ID || 1) || 1;

// --- Seed definitions -------------------------------------------------------

const EMPLOYEES = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "staff", password: "staff123", role: "staff" },
];

const CATEGORIES = [
    { slug: "coffee", name: "Coffee", description: "Coffee & hot drinks", img: "coffee.png" },
    { slug: "drinks", name: "Drinks", description: "Cold & soft drinks", img: "drinks.png" },
    { slug: "food", name: "Food", description: "Mains & savoury dishes", img: "food.png" },
    { slug: "desserts", name: "Desserts", description: "Sweet treats", img: "desserts.png" },
];

const PRODUCTS = [
    // Coffee & hot drinks
    { name: "Coffee", category: "coffee", price: 2.5, img: "coffee.png", description: "Freshly brewed coffee" },
    { name: "Espresso", category: "coffee", price: 2.0, img: "espresso.png", description: "Single shot espresso" },
    { name: "Matcha Latte", category: "coffee", price: 4.0, img: "matcha-latte.png", description: "Green tea latte" },
    { name: "Chai Latte", category: "coffee", price: 3.8, img: "chai-latte.png", description: "Spiced tea latte" },
    { name: "Hot Chocolate", category: "coffee", price: 3.5, img: "hot-chocolate.png", description: "Rich hot chocolate" },

    // Drinks
    { name: "Cola", category: "drinks", price: 2.2, img: "cola.png", description: "Chilled cola" },
    { name: "Water", category: "drinks", price: 1.5, img: "water.png", description: "Still water" },
    { name: "Lemonade", category: "drinks", price: 3.0, img: "lemonade.png", description: "Fresh lemonade" },
    { name: "Monster Energy", category: "drinks", price: 3.5, img: "monster.png", description: "Energy drink" },
    { name: "Beer", category: "drinks", price: 3.5, img: "beer.png", description: "Draft beer" },
    { name: "Heineken", category: "drinks", price: 4.0, img: "heineken.png", description: "Heineken lager" },
    { name: "Corona", category: "drinks", price: 4.2, img: "corona.png", description: "Corona Extra" },
    { name: "Aperol Spritz", category: "drinks", price: 6.5, img: "aperol.png", description: "Aperol spritz cocktail" },

    // Food
    { name: "Margherita Pizza", category: "food", price: 8.5, img: "margherita-pizza.png", description: "Tomato, mozzarella, basil" },
    { name: "Pepperoni Pizza", category: "food", price: 9.5, img: "pepperoni-pizza.png", description: "Pepperoni & cheese" },
    { name: "Carbonara", category: "food", price: 10.0, img: "carbonara.png", description: "Classic carbonara pasta" },
    { name: "Caesar Salad", category: "food", price: 7.5, img: "ceasar-salad.png", description: "Caesar salad" },
    { name: "Burger", category: "food", price: 9.0, img: "burger.png", description: "Beef burger with fries" },
    { name: "Croissant", category: "food", price: 2.8, img: "croissant.png", description: "Buttery croissant" },

    // Desserts
    { name: "Cheesecake", category: "desserts", price: 5.0, img: "cheesecake.png", description: "New York cheesecake" },
    { name: "Tiramisu", category: "desserts", price: 5.5, img: "tiramisu.png", description: "Coffee tiramisu" },
    { name: "Ice Cream", category: "desserts", price: 4.0, img: "ice-cream.png", description: "Assorted ice cream" },
    { name: "Vanilla Scoop", category: "desserts", price: 2.5, img: "vanilla-scoop.png", description: "Single vanilla scoop" },
    { name: "Blueberry Muffin", category: "desserts", price: 3.2, img: "blueberry-muffin.png", description: "Blueberry muffin" },
    { name: "Brownie", category: "desserts", price: 4.0, img: "brownie.png", description: "Chocolate brownie" },
];

const imgUrl = (file) => `/uploads/images/${file}`;

// Test-only tables. Their `token` is the permanent per-table QR token used by
// POST /api/tokens/exchange — it never expires and can be exchanged for a
// fresh access token any number of times, so these let testing place orders
// at any time without a real QR scan. No app logic is bypassed; this is only
// seed data, so keep it out of real deployments simply by not running the
// seeder there.
const TABLES = [
    { name: "Table 1", token: "seed-table-1" },
    { name: "Table 2", token: "seed-table-2" },
    { name: "Table 3", token: "seed-table-3" },
    { name: "Table 4", token: "seed-table-4" },
    { name: "Table 5", token: "seed-table-5" },
    { name: "Table 6", token: "seed-table-6" },
];

// --- Seed steps -------------------------------------------------------------

async function seedRestaurant() {
    await pool.query(
        `INSERT INTO restaurants (id, name, is_active)
         VALUES ($1, 'Default Restaurant', TRUE)
         ON CONFLICT (id) DO NOTHING`,
        [RESTAURANT_ID]
    );
}

async function seedEmployees() {
    for (const e of EMPLOYEES) {
        await pool.query(
            `INSERT INTO employees (restaurant_id, username, password, role, is_active)
             VALUES ($1, $2, $3, $4, TRUE)
             ON CONFLICT (restaurant_id, username) DO UPDATE
                SET password = EXCLUDED.password,
                    role = EXCLUDED.role,
                    is_active = TRUE`,
            [RESTAURANT_ID, e.username, e.password, e.role]
        );
    }
    console.log(`[seed] employees: ${EMPLOYEES.map((e) => e.username).join(", ")}`);
}

async function seedTables() {
    for (const t of TABLES) {
        await pool.query(
            `INSERT INTO restaurant_tables (restaurant_id, name, token, is_active)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (token) DO UPDATE
                SET name = EXCLUDED.name,
                    restaurant_id = EXCLUDED.restaurant_id,
                    is_active = TRUE`,
            [RESTAURANT_ID, t.name, t.token]
        );
    }
    console.log(`[seed] tables: ${TABLES.map((t) => t.name).join(", ")}`);
}

async function seedCategories() {
    const bySlug = {};
    for (const c of CATEGORIES) {
        const { rows } = await pool.query(
            `INSERT INTO categories (slug, name, description, is_active)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    is_active = TRUE
             RETURNING id`,
            [c.slug, c.name, c.description]
        );
        const categoryId = rows[0].id;
        bySlug[c.slug] = categoryId;

        await pool.query(
            `INSERT INTO restaurant_categories (restaurant_id, category_id, img_url)
             VALUES ($1, $2, $3)
             ON CONFLICT (restaurant_id, category_id) DO UPDATE
                SET img_url = EXCLUDED.img_url`,
            [RESTAURANT_ID, categoryId, imgUrl(c.img)]
        );
    }
    console.log(`[seed] categories: ${CATEGORIES.map((c) => c.slug).join(", ")}`);
    return bySlug;
}

// products has no unique constraint on name, so find-or-create by name.
async function findOrCreateProduct(name, description) {
    const existing = await pool.query(
        `SELECT id FROM products WHERE name = $1 LIMIT 1`,
        [name]
    );
    if (existing.rows.length) {
        await pool.query(
            `UPDATE products SET description = $2, is_active = TRUE WHERE id = $1`,
            [existing.rows[0].id, description]
        );
        return existing.rows[0].id;
    }
    const { rows } = await pool.query(
        `INSERT INTO products (name, description, is_active)
         VALUES ($1, $2, TRUE)
         RETURNING id`,
        [name, description]
    );
    return rows[0].id;
}

async function seedProducts(categoryIdBySlug) {
    for (const p of PRODUCTS) {
        const categoryId = categoryIdBySlug[p.category];
        if (!categoryId) throw new Error(`Unknown category for product ${p.name}: ${p.category}`);

        const productId = await findOrCreateProduct(p.name, p.description);

        await pool.query(
            `INSERT INTO restaurant_products (restaurant_id, product_id, category_id, price, img_url, is_active)
             VALUES ($1, $2, $3, $4, $5, TRUE)
             ON CONFLICT (restaurant_id, product_id) DO UPDATE
                SET category_id = EXCLUDED.category_id,
                    price = EXCLUDED.price,
                    img_url = EXCLUDED.img_url,
                    is_active = TRUE`,
            [RESTAURANT_ID, productId, categoryId, p.price, imgUrl(p.img)]
        );
    }
    console.log(`[seed] products: ${PRODUCTS.length} items across ${Object.keys(categoryIdBySlug).length} categories`);
}

async function runSeeds() {
    await seedRestaurant();
    await seedEmployees();
    await seedTables();
    const categoryIdBySlug = await seedCategories();
    await seedProducts(categoryIdBySlug);
}

module.exports = { runSeeds };
