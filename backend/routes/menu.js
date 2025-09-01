const express = require("express");
const router = express.Router();
const db = require("../db");

// GET all menu items
router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM menu_items");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
