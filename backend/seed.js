// seed.js — standalone seed runner
// Ensures schema (migrations) then inserts seed data, then exits.
// Env vars (DB_URL, etc.) are loaded via `-r dotenv/config` in the npm script.
const { runMigrations } = require("./migrations");
const { runSeeds } = require("./seeds");
const pool = require("./db");

(async () => {
    try {
        console.log("[seed] ensuring schema...");
        await runMigrations();
        console.log("[seed] seeding data...");
        await runSeeds();
        console.log("[seed] done");
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error("[seed] failed", err);
        await pool.end().catch(() => {});
        process.exit(1);
    }
})();
