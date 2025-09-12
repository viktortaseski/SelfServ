// routes/menu.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/menu?search=espresso
router.get("/", async (req, res) => {
    try {
        const search = req.query.search;
        let result;

        if (search) {
            result = await pool.query(
                "SELECT * FROM menu_items WHERE LOWER(name) LIKE LOWER($1)",
                [`%${search}%`]
            );
        } else {
            result = await pool.query("SELECT * FROM menu_items ORDER BY id ASC");
        }

        res.json(result.rows);
    } catch (err) {
        console.error("GET /api/menu error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
