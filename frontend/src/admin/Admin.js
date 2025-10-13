import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import MenuManager from "./MenuManager";
import Analytics from "./Analytics";
import { apiMe, apiLogout } from "./dashboardApi";
import "./dashboard.css";

function Admin() {
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [view, _setView] = useState(() => localStorage.getItem('admin_view') || "dashboard"); // 'dashboard' | 'item-upload' | 'analytics'

    const setView = (v) => {
        _setView(v);
        try { localStorage.setItem('admin_view', v); } catch {}
    };

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
                <button
                    className={`nav-tab ${view === 'analytics' ? 'nav-tab--active' : ''}`}
                    onClick={() => setView('analytics')}
                >
                    Analytics & Reporting
                </button>
            </nav>

            {view === 'dashboard' ? <Dashboard /> : view === 'analytics' ? <Analytics /> : <MenuManager />}
        </div>
    );
}

export default Admin;
