import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import MenuManager from "./MenuManager";
import { apiMe, apiLogout } from "./dashboardApi";
import "./dashboard.css";

function Admin() {
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [view, setView] = useState("dashboard"); // 'dashboard' | 'item-upload'

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const me = await apiMe();
                if (mounted) setUser(me);
            } catch {
                // not logged in
            } finally {
                if (mounted) setLoadingUser(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const refreshMe = async () => {
        try {
            const me = await apiMe();
            setUser(me);
        } catch {
            setUser(null);
        }
    };

    const handleLogout = async () => {
        await apiLogout();
        setUser(null);
    };

    if (loadingUser) return <div className="p-16">Loading…</div>;
    if (!user || user.role !== "admin") {
        return <Login onSuccess={refreshMe} />;
    }

    return (
        <div className="admin-container">
            <header className="admin-header mb-16">
                <h2 className="mt-0">RockCafe · Admin</h2>
                <div className="row gap-8">
                    <span className="muted">
                        Signed in as <strong>{user.username}</strong> ({user.role})
                    </span>
                    <button onClick={handleLogout} className="btn btn-ghost">Logout</button>
                </div>
            </header>

            <nav className="admin-navbar mb-16">
                <button
                    className={`nav-tab ${view === 'dashboard' ? 'nav-tab--active' : ''}`}
                    onClick={() => setView('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    className={`nav-tab ${view === 'item-upload' ? 'nav-tab--active' : ''}`}
                    onClick={() => setView('item-upload')}
                >
                    Menu Manager
                </button>
            </nav>

            {view === 'dashboard' ? <Dashboard /> : <MenuManager />}
        </div>
    );
}

export default Admin;
