// ⭐ CHANGED: replaced JWT with session check

const authMiddleware = (roles = []) => {
    return (req, res, next) => {

        console.log("🔑 Auth check started");
        console.log("➡️ Session object:", req.session);

        if (!req.session || !req.session.user) {
            console.log("❌ No user in session");
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = req.session.user;
        console.log("✅ Found user in session:", user);

        if (roles.length && !roles.includes(user.role)) {
            console.log(
                `❌ Role check failed. Required: [${roles.join(", ")}], Got: ${user.role}`
            );

            return res.status(403).json({ error: "Forbidden: insufficient role" });
        }

        req.user = user; // attach user from session
        next();
    };
};

module.exports = authMiddleware;
