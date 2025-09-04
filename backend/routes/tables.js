const express = require("express");
const router = express.Router();
const pool = require("../db"); // adjust path to your db.js

// GET /api/tables/:token
router.get("/:token", async (req, res) => {
    const { token } = req.params;
    try {
        const result = await pool.query("SELECT * FROM tables WHERE token = $1", [token]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Table not found" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
