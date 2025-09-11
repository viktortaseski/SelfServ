import React, { useState, useEffect } from "react";
import api from "../api";

function WaiterLogin({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loggedInUser, setLoggedInUser] = useState(null);

    // ⭐ NEW: Check if already logged in on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await api.get("/users/me", { withCredentials: true }); // ⭐ CHANGED
                setLoggedInUser(res.data);
                localStorage.setItem("role", res.data.role);
            } catch (err) {
                console.log("No active session");
            }
        };
        checkSession();
    }, []);

    const handleLogin = async () => {
        try {
            const res = await api.post("/users/login", { username, password });
            const data = res.data;

            if (res.status === 200 && data.success) {
                setLoggedInUser({ username: data.username, role: data.role });
                localStorage.setItem("role", data.role);
                if (onLogin) onLogin(data);
                alert(`Welcome ${data.role} ${username}!`);
            } else {
                alert(data.error || "Login failed");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    };


    const handleLogout = async () => {
        try {
            await fetch("/users/logout", {
                method: "POST",
                credentials: "include",
            });
            setLoggedInUser(null);
            localStorage.removeItem("role");
            alert("Logged out successfully");
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Waiter Login</h2>
            {loggedInUser ? (
                <div>
                    <p>
                        Logged in as <b>{loggedInUser.username}</b> ({loggedInUser.role})
                    </p>
                    <button onClick={handleLogout}>Logout</button>
                </div>
            ) : (
                <>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <br />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <br />
                    <button onClick={handleLogin}>Login</button>
                </>
            )}
        </div>
    );
}

export default WaiterLogin;
