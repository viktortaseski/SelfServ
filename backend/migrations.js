// migrations.js
const pool = require("./db");

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

async function runMigrations() {
    await addClaimedByWorkerColumn();
}

module.exports = {
    runMigrations,
};
