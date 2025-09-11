import React, { useState } from "react";

function WaiterLogin({ onLogin }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        try {
            const res = await fetch("/api/users/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // ⭐ CHANGED: include cookies
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
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

    return (
        <div style={{ padding: "20px" }}>
            <h2>Waiter Login</h2>
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
        </div>
    );
}

export default WaiterLogin;
