// backend/server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const tokenRoutes = require("./routes/tokens"); // <-- added
const usersRouter = require("./routes/users");
const pool = require("./db");

const app = express();

app.set("trust proxy", 1);

app.use(
    cors({
        origin: [
            "https://selfserv-web.onrender.com",
            "http://localhost:3000",
        ],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Set-Cookie"],
        credentials: true,
    })
);

app.use(bodyParser.json());

app.use(
    session({
        store: new pgSession({
            pool,
            tableName: "user_sessions",
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET || "keyboardcat",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: true,
            httpOnly: true,
            sameSite: "none",
            maxAge: 1000 * 60 * 60 * 8,
        },
        name: "sid",
    })
);

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/tokens", tokenRoutes); // <-- added
app.use("/api/users", usersRouter);

app.get("/api/debug/session", (req, res) => {
    res.json({
        hasUser: !!(req.session && req.session.user),
        user: req.session?.user || null,
        cookie: req.session?.cookie || null,
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
