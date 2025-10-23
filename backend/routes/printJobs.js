// routes/printJobs.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { DEFAULT_RESTAURANT_ID } = require("../config");

async function requirePrintAuth(req, res, next) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const printerRes = await pool.query(
            `
            SELECT id,
                   restaurant_id,
                   label,
                   queue_name,
                   api_base,
                   api_token,
                   is_active
              FROM restaurant_printer
             WHERE api_token = $1
               AND coalesce(is_active, true) = true
             LIMIT 1
            `,
            [token]
        );

        if (printerRes.rowCount === 0) {
            if (process.env.PRINT_API_TOKEN && token === process.env.PRINT_API_TOKEN) {
                req.printer = {
                    id: null,
                    restaurant_id: Number(process.env.DEFAULT_RESTAURANT_ID || DEFAULT_RESTAURANT_ID || 1),
                    label: "Default Printer",
                    queue_name: process.env.PRINTER_QUEUE || "PrinterCMD_ESCPO_POS80_Printer_USB",
                    api_base: process.env.API_BASE || "",
                };
                return next();
            }
            return res.status(401).json({ error: "Unauthorized" });
        }

        const printer = printerRes.rows[0];
        if (!printer.api_base) {
            printer.api_base = process.env.API_BASE || "";
        }
        req.printer = printer;
        return next();
    } catch (err) {
        console.error("[print-jobs/auth]", err);
        return res.status(500).json({ error: "Server error" });
    }
}

router.get("/config", requirePrintAuth, async (req, res) => {
    const { printer } = req;
    return res.json({
        printer: {
            id: printer.id,
            restaurantId: printer.restaurant_id,
            label: printer.label,
            queueName: printer.queue_name,
            apiBase: printer.api_base || process.env.API_BASE || "",
        },
    });
});

router.post("/claim", requirePrintAuth, async (req, res) => {
    const { printer } = req;
    const rawWorker = req.body?.worker ?? req.body?.workerId ?? req.ip ?? "unknown";
    const workerLabel = String(rawWorker || "").trim() || "unknown";
    const workerName = workerLabel.slice(0, 120);

    const claimedByRaw =
        req.body?.claimedById ??
        req.body?.employeeId ??
        (typeof rawWorker === "number" ? rawWorker : undefined);

    let claimedById = null;
    const candidate = Number(claimedByRaw);
    if (Number.isInteger(candidate) && candidate > 0) {
        claimedById = candidate;
    } else if (typeof rawWorker === "string" && /^\d+$/.test(rawWorker.trim())) {
        claimedById = Number(rawWorker.trim());
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const q = `
            WITH next_job AS (
                SELECT pj.id
                  FROM print_jobs pj
                  JOIN orders o ON o.id = pj.order_id
                 WHERE pj.status = 'queued'
                   AND o.restaurant_id = $1
                 ORDER BY pj.id
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
            )
            UPDATE print_jobs pj
               SET status='claimed',
                   claimed_at=now(),
                   claimed_by=$2,
                   claimed_by_worker=$3
             WHERE pj.id = (SELECT id FROM next_job)
            RETURNING id, order_id, payload;
        `;
        const r = await client.query(q, [printer.restaurant_id, claimedById, workerName]);
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
    const { printer } = req;
    const id = Number(req.params.id);
    const r = await pool.query(
        `
        UPDATE print_jobs pj
           SET status='printed',
               finished_at=now(),
               last_error=NULL
         WHERE pj.id=$1
           AND EXISTS (
                SELECT 1
                  FROM orders o
                 WHERE o.id = pj.order_id
                   AND o.restaurant_id = $2
           )
        `,
        [id, printer.restaurant_id]
    );
    return res.json({ updated: r.rowCount === 1 });
});

router.post("/:id/error", requirePrintAuth, async (req, res) => {
    const { printer } = req;
    const id = Number(req.params.id);
    const msg = String(req.body?.error || "").slice(0, 500);
    const r = await pool.query(
        `
        UPDATE print_jobs pj
           SET status='failed',
               finished_at=now(),
               last_error=$2
         WHERE pj.id=$1
           AND EXISTS (
                SELECT 1
                  FROM orders o
                 WHERE o.id = pj.order_id
                   AND o.restaurant_id = $3
           )
        `,
        [id, msg, printer.restaurant_id]
    );
    return res.json({ updated: r.rowCount === 1 });
});

module.exports = router;
