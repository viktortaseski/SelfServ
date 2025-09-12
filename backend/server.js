const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const usersRouter = require("./routes/users");

const app = express();

// CORS
app.use(cors({
    origin: [
        "https://selfserv-web.onrender.com",  // prod frontend
        "http://localhost:3000",             // dev
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

// Body parser
app.use(bodyParser.json());

// Session (for cookie-based auth)
app.use(session({
    secret: process.env.SESSION_SECRET || "keyboardcat",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,        // ✅ must be true in production (HTTPS)
        httpOnly: true,
        sameSite: "None",    // ✅ required for cross-site cookies
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/users", usersRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
