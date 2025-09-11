import React, { useState } from "react";

function WaiterLogin({ setToken }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        const res = await fetch("/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.token) {
            localStorage.setItem("token", data.token);
            setToken(data.token);
        } else {
            alert(data.error);
        }
    };

    return (
        <div>
            <h2>Waiter Login</h2>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
            <button onClick={handleLogin}>Login</button>
        </div>
    );
}

export default WaiterLogin;
