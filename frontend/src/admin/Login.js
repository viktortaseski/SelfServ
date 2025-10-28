import { useState } from "react";
import { apiLogin } from "./dashboardApi";
import "./dashboard.css";

function Login({ onSuccess }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
            const res = await apiLogin(username, password);
            if (res?.success) onSuccess?.();
            else setErr(res?.error || "Login failed");
        } catch (e2) {
            setErr(e2?.message || "Login error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="center-box">
            <div className="card">
                <h2 className="mt-0">Account Login</h2>
                <form onSubmit={handleSubmit} className="grid-gap-10">
                    <label className="form-label">
                        Username
                        <input
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            required
                        />
                    </label>
                    <label className="form-label">
                        Password
                        <input
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                    </label>
                    {err ? <div className="error-text">{err}</div> : null}
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
