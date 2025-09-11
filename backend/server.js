const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const usersRouter = require("./routes/users");

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET || "keyboardcat",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set true if HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/users", usersRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
