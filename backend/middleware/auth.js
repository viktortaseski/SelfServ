// middleware/auth.js
const authMiddleware = (roles = []) => {
    return (req, res, next) => {
        console.log("🔑 Session data:", req.session);
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = req.session.user;
        console.log("✅ Authenticated user:", user);

        if (roles.length && !roles.includes(user.role)) {
            return res.status(403).json({ error: "Forbidden: insufficient role" });
        }

        req.user = user;
        next();
    };
};

module.exports = authMiddleware;
