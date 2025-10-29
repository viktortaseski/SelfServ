import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import MenuManager from "./MenuManager";
import Analytics from "./Analytics";
import WaiterApp from "../waiter/WaiterApp";
import { apiMe, apiLogout, hasValidToken } from "./dashboardApi";
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
        if (!hasValidToken()) {
            setLoadingUser(false);
            return;
        }
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

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            if (!hasValidToken()) {
                setUser(null);
                setLoadingUser(false);
            }
        }, 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

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
    if (!user) {
        return <Login onSuccess={refreshMe} />;
    }

    if (user.role === "staff") {
        return <WaiterApp user={user} onLogout={handleLogout} />;
    }

    if (user.role !== "admin") {
        return (
            <div className="p-16">
                <p className="mb-12">Your account does not have access to this area.</p>
                <button onClick={handleLogout} className="btn btn-primary">
                    Logout
                </button>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <header className="admin-header mb-16">
                <h2 className="mt-0">
                    {user?.restaurant_name ? `${user.restaurant_name} · Admin` : "Admin"}
                </h2>
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

            {view === 'dashboard'
                ? <Dashboard user={user} />
                : view === 'analytics'
                    ? <Analytics user={user} />
                    : <MenuManager user={user} />}
        </div>
    );
}

export default Admin;
