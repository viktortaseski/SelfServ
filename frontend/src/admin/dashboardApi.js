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
    try {
        const { data } = await api.post(`/users/login`, { username, password });
        if (data?.success && data?.token) setToken(data.token);
        return data;
    } catch (err) {
        const serverMsg = err?.response?.data?.error;
        const msg =
            serverMsg && /user|password/i.test(serverMsg)
                ? "Incorrect username or password"
                : "Incorrect username or password";
        return { success: false, error: msg };
    }
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

export async function apiFetchCategories({ restaurantId, auth } = {}) {
    try {
        const params = new URLSearchParams();
        if (restaurantId) params.set("restaurantId", String(restaurantId));
        const qs = params.toString();
        const config = {};
        if (auth) {
            const token = getToken();
            if (!token) throw new Error("No token");
            config.headers = { Authorization: `Bearer ${token}` };
        }
        const { data } = await api.get(`/menu/categories${qs ? `?${qs}` : ""}`, config);
        if (!Array.isArray(data)) return [];
        return data;
    } catch {
        return [];
    }
}

// --- Admin: create menu item ---
export async function apiCreateMenuItem({ name, price, category, imageDataUrl }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {
        name,
        price,
        category,
        image: imageDataUrl || null,
    };
    const { data } = await api.post(`/menu`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

// --- Admin: list menu items (optional search)
export async function apiListMenuItems({ search, category, minPrice, maxPrice } = {}) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const params = new URLSearchParams();
    params.set("includeInactive", "true");
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (minPrice != null && minPrice !== "") params.set("minPrice", String(minPrice));
    if (maxPrice != null && maxPrice !== "") params.set("maxPrice", String(maxPrice));
    const qs = params.toString();
    const { data } = await api.get(`/menu/admin${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

// --- Admin: update menu item ---
export async function apiUpdateMenuItem(id, { name, price, category, imageDataUrl }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {
        name,
        price,
        category,
        image: imageDataUrl || undefined,
    };
    const { data } = await api.put(`/menu/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

// --- Admin: delete menu item ---
export async function apiDeleteMenuItem(id) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.delete(`/menu/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

export async function apiAddItemToMenu(id) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.post(`/menu/${id}/menu`, null, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

export async function apiRemoveItemFromMenu(id) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.delete(`/menu/${id}/menu`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}
