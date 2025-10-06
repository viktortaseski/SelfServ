// routes/printJobs.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

function requirePrintAuth(req, res, next) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token || token !== process.env.PRINT_API_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

router.post("/claim", requirePrintAuth, async (req, res) => {
    const worker = req.body?.worker || req.ip || "unknown";
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const q = `
      UPDATE print_jobs pj
         SET status='claimed', claimed_at=now(), claimed_by=$1
       WHERE pj.id = (
         SELECT id FROM print_jobs
          WHERE status='queued'
          ORDER BY id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
      RETURNING id, order_id, payload;
    `;
        const r = await client.query(q, [worker]);
        await client.query("COMMIT");
        return res.json({ job: r.rows[0] || null });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("[print-jobs/claim]", e);
        return res.status(500).json({ error: "Server error" });
    } finally {
        client.release();
    }
});

router.post("/:id/done", requirePrintAuth, async (req, res) => {
    const id = Number(req.params.id);
    const r = await pool.query(
        `UPDATE print_jobs SET status='done', finished_at=now(), last_error=NULL WHERE id=$1`,
        [id]
    );
    return res.json({ updated: r.rowCount === 1 });
});

router.post("/:id/error", requirePrintAuth, async (req, res) => {
    const id = Number(req.params.id);
    const msg = String(req.body?.error || "").slice(0, 500);
    const r = await pool.query(
        `UPDATE print_jobs SET status='error', finished_at=now(), last_error=$2 WHERE id=$1`,
        [id, msg]
    );
    return res.json({ updated: r.rowCount === 1 });
});

module.exports = router;     
