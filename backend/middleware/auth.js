const jwt = require("jsonwebtoken");

const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({ error: "Missing token" });
        }

        const token = authHeader.split(" ")[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: "Invalid token" });

            if (roles.length && !roles.includes(user.role)) {
                return res.status(403).json({ error: "Forbidden: insufficient role" });
            }

            req.user = user; // attach user to request
            next();
        });
    };
};

module.exports = authMiddleware;
