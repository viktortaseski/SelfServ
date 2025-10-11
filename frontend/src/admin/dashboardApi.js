// src/admin/dashboardApi.js
import api from "../api";

// Use localStorage for a simple stateless token
const TOKEN_KEY = "admin_token";

export function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
}
export function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
}

// --- Dates ---
export function DEFAULT_FROM_STR() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}
export function DEFAULT_TO_STR() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString().slice(0, 10);
}

// --- Auth calls (stateless) ---
export async function apiLogin(username, password) {
    const { data } = await api.post(`/users/login`, { username, password });
    if (data?.success && data?.token) setToken(data.token);
    return data;
}
export async function apiMe() {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.get(`/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}
export async function apiLogout() {
    setToken("");
    try {
        await api.post(`/users/logout`);
    } catch { /* ignore */ }
    return { success: true };
}

// --- Orders fetch (admin) ---
export async function apiFetchOrdersAdmin({ from, to, status, tableId, q, limit }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (tableId) params.set("tableId", tableId);
    if (q) params.set("q", q);
    if (limit) params.set("limit", String(limit));

    const { data } = await api.get(`/orders/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

// --- Stats helper & fmt ---
export function computeStats(orders = []) {
    const totalOrders = orders.length;
    const totalItems = orders.reduce(
        (s, o) => s + (o.items || []).reduce((t, it) => t + (it.quantity || 0), 0),
        0
    );
    const revenue = orders.reduce(
        (s, o) => s + Number(o.subtotal || 0) + Number(o.tip || 0),
        0
    );

    const byMonth = new Map();
    for (const o of orders) {
        const k = (o.created_at || "").slice(0, 7);
        if (!byMonth.has(k)) byMonth.set(k, { orders: 0, revenue: 0 });
        const row = byMonth.get(k);
        row.orders += 1;
        row.revenue += Number(o.subtotal || 0) + Number(o.tip || 0);
    }
    const monthRows = [...byMonth.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([month, v]) => ({ month, ...v }));

    return { totalOrders, totalItems, revenue, monthRows };
}

export function fmtMKD(n) {
    const x = Math.round(Number(n) || 0);
    return `${x.toLocaleString("mk-MK")} MKD`;
}
