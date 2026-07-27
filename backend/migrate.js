// migrate.js — standalone migration runner
// Runs the same migrations as server startup, then exits.
// Env vars (DB_URL, etc.) are loaded via `-r dotenv/config` in the npm script.
const { runMigrations } = require("./migrations");
const pool = require("./db");

(async () => {
    try {
        console.log("[migrate] running migrations...");
        await runMigrations();
        console.log("[migrate] done");
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error("[migrate] failed", err);
        await pool.end().catch(() => {});
        process.exit(1);
    }
})();
