import { useCallback, useEffect, useMemo, useState } from "react";
import {
    apiListEmployees,
    apiCreateEmployee,
    apiUpdateEmployee,
} from "./dashboardApi";
import "./dashboard.css";

const ROLE_OPTIONS = [
    { value: "admin", label: "Admin" },
    { value: "staff", label: "Staff" },
];

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return "—";
    }
}

export default function EmployeeManager({ currentUser }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);
    const [createErr, setCreateErr] = useState("");
    const [form, setForm] = useState({
        username: "",
        password: "",
        role: "staff",
        isActive: true,
    });
    const [pendingId, setPendingId] = useState(null);

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const rows = await apiListEmployees();
            setEmployees(rows);
        } catch (err) {
            setError(err?.message || "Failed to load employees");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEmployees();
    }, [loadEmployees]);

    const handleCreate = async (evt) => {
        evt.preventDefault();
        if (creating) return;
        setCreating(true);
        setCreateErr("");
        try {
            const payload = {
                username: form.username.trim(),
                password: form.password,
                role: form.role,
                isActive: form.isActive,
            };
            const created = await apiCreateEmployee(payload);
            if (created) {
                setForm({
                    username: "",
                    password: "",
                    role: "staff",
                    isActive: true,
                });
                setEmployees((prev) => {
                    const next = [...prev, created];
                    return next.sort((a, b) => a.username.localeCompare(b.username));
                });
            }
        } catch (err) {
            setCreateErr(err?.response?.data?.error || err?.message || "Failed to create employee");
        } finally {
            setCreating(false);
        }
    };

    const updateEmployee = async (id, updates) => {
        setPendingId(id);
        setError("");
        try {
            const updated = await apiUpdateEmployee(id, updates);
            if (updated) {
                setEmployees((prev) =>
                    prev.map((emp) => (emp.id === id ? { ...emp, ...updated } : emp))
                );
            }
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || "Update failed");
            await loadEmployees();
        } finally {
            setPendingId(null);
        }
    };

    const sortedEmployees = useMemo(
        () => [...employees].sort((a, b) => a.username.localeCompare(b.username)),
        [employees]
    );

    const isSelf = (id) => currentUser && Number(currentUser.id) === Number(id);

    return (
        <section className="card mt-16">
            <div className="row space-between align-center">
                <h3 className="mt-0 mb-12">Employee Management</h3>
                {loading ? <span className="muted small">Refreshing…</span> : null}
            </div>

            {error ? <div className="error-text mb-12">{error}</div> : null}

            <form className="card card--light mb-16" onSubmit={handleCreate}>
                <h4 className="mt-0 mb-12">Create employee</h4>
                <div className="grid gap-12 employee-form-grid">
                    <label className="form-label">
                        Username
                        <input
                            className="input"
                            value={form.username}
                            minLength={3}
                            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                            required
                        />
                    </label>
                    <label className="form-label">
                        Password
                        <input
                            className="input"
                            type="password"
                            minLength={4}
                            value={form.password}
                            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                            required
                        />
                    </label>
                    <label className="form-label">
                        Role
                        <select
                            className="input"
                            value={form.role}
                            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                        >
                            {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="form-label">
                        Active
                        <select
                            className="input"
                            value={form.isActive ? "true" : "false"}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, isActive: e.target.value === "true" }))
                            }
                        >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                        </select>
                    </label>
                </div>
                {createErr ? <div className="error-text mt-8">{createErr}</div> : null}
                <div className="mt-12">
                    <button className="btn btn-primary" type="submit" disabled={creating}>
                        {creating ? "Creating…" : "Create employee"}
                    </button>
                </div>
            </form>

            <div className="table-wrap">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Last login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!sortedEmployees.length ? (
                            <tr>
                                <td colSpan={5} className="muted">
                                    No employees yet.
                                </td>
                            </tr>
                        ) : (
                            sortedEmployees.map((emp) => {
                                const disabled = pendingId === emp.id;
                                return (
                                    <tr key={emp.id}>
                                        <td>{emp.username}</td>
                                        <td>
                                            <select
                                                className="input input--dense"
                                                value={emp.role}
                                                disabled={disabled || isSelf(emp.id)}
                                                onChange={(e) => updateEmployee(emp.id, { role: e.target.value })}
                                            >
                                                {ROLE_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <span className={emp.is_active ? "badge badge--active" : "badge badge--inactive"}>
                                                {emp.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td>{fmtDate(emp.last_login)}</td>
                                        <td>
                                            <button
                                                className="btn btn-ghost"
                                                disabled={disabled || isSelf(emp.id)}
                                                onClick={() =>
                                                    updateEmployee(emp.id, { isActive: !emp.is_active })
                                                }
                                            >
                                                {emp.is_active ? "Deactivate" : "Activate"}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
