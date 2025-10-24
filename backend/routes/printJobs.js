// routes/printJobs.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { DEFAULT_RESTAURANT_ID } = require("../config");

function extractPrinterId(req) {
    const candidates = [
        req.query?.printerId,
        req.query?.printer_id,
        req.body?.printerId,
        req.body?.printer_id,
        req.params?.printerId,
        req.params?.printer_id,
        req.headers?.["x-printer-id"],
        req.headers?.["x-printer_id"],
    ];
    for (const raw of candidates) {
        const n = Number(raw);
        if (Number.isInteger(n) && n > 0) return n;
    }
    return null;
}

async function requirePrintAuth(req, res, next) {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const requestedPrinterId = extractPrinterId(req);

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
               AND ($2::BIGINT IS NULL OR id = $2)
               AND coalesce(is_active, true) = true
             LIMIT 1
            `,
            [token, requestedPrinterId]
        );

        if (printerRes.rowCount === 0) {
            if (process.env.PRINT_API_TOKEN && token === process.env.PRINT_API_TOKEN) {
                if (!requestedPrinterId) {
                    return res.status(400).json({ error: "printerId is required" });
                }
                req.printer = {
                    id: requestedPrinterId,
                    restaurant_id: Number(process.env.DEFAULT_RESTAURANT_ID || DEFAULT_RESTAURANT_ID || 1),
                    label: "Default Printer",
                    queue_name: process.env.PRINTER_QUEUE || "PrinterCMD_ESCPO_POS80_Printer_USB",
                    api_base: process.env.API_BASE || "",
                };
                req.printerId = requestedPrinterId;
                return next();
            }
            return res.status(401).json({ error: "Unauthorized" });
        }

        const printer = printerRes.rows[0];
        const printerId = Number(printer.id);
        const printerRestaurantId = Number(printer.restaurant_id);
        if (Number.isFinite(printerId)) {
            printer.id = printerId;
        }
        if (Number.isFinite(printerRestaurantId)) {
            printer.restaurant_id = printerRestaurantId;
        }
        if (!printer.api_base) {
            printer.api_base = process.env.API_BASE || "";
        }
        if (requestedPrinterId && printer.id !== requestedPrinterId) {
            return res.status(403).json({ error: "Printer mismatch for token" });
        }
        req.printer = printer;
        req.printerId = printer.id;
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
    const targetPrinterId = Number.isInteger(Number(req.printerId))
        ? Number(req.printerId)
        : (Number.isInteger(Number(printer.id)) ? Number(printer.id) : null);

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
                   AND ($2::BIGINT IS NULL OR pj.printer_id = $2 OR pj.printer_id IS NULL)
                 ORDER BY pj.id
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
            )
            UPDATE print_jobs pj
               SET status='claimed',
                   claimed_at=now(),
                   claimed_by=$3,
                   claimed_by_worker=$4,
                   printer_id = COALESCE(pj.printer_id, $2)
             WHERE pj.id = (SELECT id FROM next_job)
            RETURNING id, order_id, payload, printer_id;
        `;
        const r = await client.query(q, [
            printer.restaurant_id,
            targetPrinterId,
            claimedById,
            workerName,
        ]);
        await client.query("COMMIT");
        if (r.rowCount === 0) {
            return res.json({ job: null });
        }
        const job = r.rows[0];
        if (!job.payload) {
            job.payload = null;
        }
        job.printerId = job.printer_id ?? targetPrinterId ?? null;
        delete job.printer_id;
        return res.json({ job });
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
    const targetPrinterId = Number.isInteger(Number(req.body?.printerId))
        ? Number(req.body.printerId)
        : (Number.isInteger(Number(req.printerId)) ? Number(req.printerId) : null);
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
           AND ($3::BIGINT IS NULL OR pj.printer_id = $3)
        `,
        [id, printer.restaurant_id, targetPrinterId]
    );
    return res.json({ updated: r.rowCount === 1 });
});

router.post("/:id/error", requirePrintAuth, async (req, res) => {
    const { printer } = req;
    const id = Number(req.params.id);
    const msg = String(req.body?.error || "").slice(0, 500);
    const targetPrinterId = Number.isInteger(Number(req.body?.printerId))
        ? Number(req.body.printerId)
        : (Number.isInteger(Number(req.printerId)) ? Number(req.printerId) : null);
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
           AND ($4::BIGINT IS NULL OR pj.printer_id = $4)
        `,
        [id, msg, printer.restaurant_id, targetPrinterId]
    );
    return res.json({ updated: r.rowCount === 1 });
});

module.exports = router;
