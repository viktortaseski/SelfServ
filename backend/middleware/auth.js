// middleware/auth.js
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "devjwtsecret";

module.exports = (roles = []) => {
    return (req, res, next) => {
        const auth = req.headers.authorization || "";
        if (!auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        const token = auth.slice(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET); // { id, role, username, iat, exp }
            if (roles.length && !roles.includes(decoded.role)) {
                return res.status(403).json({ error: "Forbidden: insufficient role" });
            }
            req.user = decoded;
            next();
        } catch {
            return res.status(401).json({ error: "Invalid token" });
        }
    };
};
