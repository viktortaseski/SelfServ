// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tokenRoutes = require("./routes/tokens");
// const tableRoutes = require("./routes/tables"); // removed in v1
// const usersRouter = require("./routes/users");  // removed in v1

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
        credentials: true,
    })
);

app.use(bodyParser.json());

// Customer-facing routes only
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tokens", tokenRoutes);

// Removed waiter-only routes:
// app.use("/api/tables", tableRoutes);
// app.use("/api/users", usersRouter);

// Removed debug session endpoint (no sessions in v1).
// app.get("/api/debug/session", ...)

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
