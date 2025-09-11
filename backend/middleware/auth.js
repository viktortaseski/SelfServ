// ⭐ CHANGED: replaced JWT with session check

const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = req.session.user;
        if (roles.length && !roles.includes(user.role)) {
            return res.status(403).json({ error: "Forbidden: insufficient role" });
        }

        req.user = user; // attach user from session
        next();
    };
};

module.exports = authMiddleware;
