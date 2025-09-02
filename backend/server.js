const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);

// Important: use Render's port if provided
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
