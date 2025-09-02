const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM menu_items");
        res.json(result.rows);
    } catch (err) {
        console.error("DB Error:", err);   // log full error
        res.status(500).json({ error: err.message || "Unknown DB error" });
    }
});

module.exports = router;
