// backend/server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const usersRouter = require("./routes/users");

const app = express();

/**
 * IMPORTANT for secure cookies behind Render/HTTPS:
 * Trust the proxy so express-session can correctly detect HTTPS
 */
app.set("trust proxy", 1);

// CORS
app.use(cors({
    origin: [
        "https://selfserv-web.onrender.com",  // frontend
        "http://localhost:3000",              // dev
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Set-Cookie"],
    credentials: true,
}));

app.use(bodyParser.json());

// Session (cookie-based auth)
app.use(session({
    secret: process.env.SESSION_SECRET || "keyboardcat",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,        // HTTPS only
        httpOnly: true,
        sameSite: "none",    // allow cross-site cookie
        domain: ".onrender.com", // share across subdomains
        maxAge: 1000 * 60 * 60 * 8,
    },
}));

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/users", usersRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
