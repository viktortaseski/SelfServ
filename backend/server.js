// backend/server.js
const express = require("express");
const cors = require("cors");

const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const usersRouter = require("./routes/users");

const app = express();
app.use(cors());
app.use(express.json()); // built-in body parser

app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/users", usersRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
