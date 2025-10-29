import api from "../api";

const TOKEN_KEY = "admin_token";
const TOKEN_EXP_KEY = "admin_token_expires_at";
const TOKEN_MAX_AGE_MS = 9 * 60 * 60 * 1000; // 9 hours

function getSessionStorage() {
    if (typeof window === "undefined") return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function clearLegacyLocalStorage() {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(TOKEN_EXP_KEY);
    } catch {
        // ignore storage failures
    }
}

export function setToken(t) {
    const storage = getSessionStorage();
    if (!storage) return;
    try {
        if (t) {
            storage.setItem(TOKEN_KEY, t);
            storage.setItem(
                TOKEN_EXP_KEY,
                String(Date.now() + TOKEN_MAX_AGE_MS)
            );
        } else {
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(TOKEN_EXP_KEY);
        }
    } catch {
        // ignore storage failures
    }
    clearLegacyLocalStorage();
}

export function getToken() {
    const storage = getSessionStorage();
    if (!storage) {
        clearLegacyLocalStorage();
        return "";
    }
    try {
        const token = storage.getItem(TOKEN_KEY);
        if (!token) return "";
        const expiresRaw = storage.getItem(TOKEN_EXP_KEY);
        const expires = Number(expiresRaw || 0);
        if (!expires || Date.now() > expires) {
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(TOKEN_EXP_KEY);
            return "";
        }
        return token;
    } catch {
        if (storage) {
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(TOKEN_EXP_KEY);
        }
        return "";
    } finally {
        clearLegacyLocalStorage();
    }
}

export function hasValidToken() {
    return !!getToken();
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
        if (auth) {
            const categories = await apiListRestaurantCategories();
            return (categories || []).map((cat) => ({
                slug: cat.slug,
                name: cat.name,
            }));
        }
        const params = new URLSearchParams();
        if (restaurantId) params.set("restaurantId", String(restaurantId));
        const qs = params.toString();
        const { data } = await api.get(`/menu/categories${qs ? `?${qs}` : ""}`);
        if (!Array.isArray(data)) return [];
        return data;
    } catch {
        return [];
    }
}

// --- Admin: create menu item ---
export async function apiCreateMenuItem({ name, price, category, imageDataUrl, description, productId }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {
        name,
        price,
        category,
        image: imageDataUrl || null,
    };
    if (description != null && description !== "") payload.description = description;
    if (productId != null) payload.productId = productId;
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
export async function apiUpdateMenuItem(id, { name, price, category, imageDataUrl, removeImage = false }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {
        name,
        price,
        category,
    };
    if (removeImage) {
        payload.image = null;
    } else if (imageDataUrl !== undefined) {
        payload.image = imageDataUrl || null;
    }
    const { data } = await api.put(`/menu/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

export async function apiListRestaurantCategories() {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.get(`/menu/categories/admin`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return Array.isArray(data?.categories) ? data.categories : [];
}

export async function apiAddRestaurantCategory({ categoryId, name, imageDataUrl }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {};
    if (categoryId != null) payload.categoryId = categoryId;
    if (name) payload.name = name;
    if (imageDataUrl !== undefined) payload.image = imageDataUrl || null;
    const { data } = await api.post(`/menu/categories/admin`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.category || null;
}

export async function apiUpdateRestaurantCategory(id, { imageDataUrl, removeImage = false }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {};
    if (removeImage) payload.removeImage = true;
    if (imageDataUrl !== undefined) payload.image = imageDataUrl || null;
    const { data } = await api.patch(`/menu/categories/admin/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.category || null;
}

export async function apiDeleteRestaurantCategory(id) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.delete(`/menu/categories/admin/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data;
}

export async function apiSearchCategoriesByName(query) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const qs = params.toString();
    const { data } = await api.get(`/menu/categories/search${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return Array.isArray(data?.categories) ? data.categories : [];
}

export async function apiSearchProductsByName(query) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const qs = params.toString();
    const { data } = await api.get(`/menu/products/search${qs ? `?${qs}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const list = Array.isArray(data?.products) ? data.products : [];
    return list.map((prod) => ({
        ...prod,
        restaurantPrice:
            prod?.restaurantPrice != null ? Number(prod.restaurantPrice) : null,
        samplePrice:
            prod?.samplePrice != null ? Number(prod.samplePrice) : null,
    }));
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

// --- Admin: employee management ---
export async function apiListEmployees() {
    const token = getToken();
    if (!token) throw new Error("No token");
    const { data } = await api.get(`/users/admin/employees`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return Array.isArray(data?.employees) ? data.employees : [];
}

export async function apiCreateEmployee({ username, password, role, isActive }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {
        username,
        password,
        role,
        isActive,
    };
    const { data } = await api.post(`/users/admin/employees`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.employee || null;
}

export async function apiUpdateEmployee(id, { role, isActive, password }) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = {};
    if (role !== undefined) payload.role = role;
    if (isActive !== undefined) payload.isActive = isActive;
    if (password !== undefined) payload.password = password;
    const { data } = await api.patch(`/users/admin/employees/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.employee || null;
}

// --- Admin: restaurant status ---
export async function apiFetchRestaurantStatus(restaurantId) {
    const params = new URLSearchParams();
    if (restaurantId) params.set("restaurantId", String(restaurantId));
    const qs = params.toString();
    const { data } = await api.get(`/restaurants/status${qs ? `?${qs}` : ""}`);
    return data?.restaurant || null;
}

export async function apiUpdateRestaurantStatus(isActive) {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = { isActive };
    const { data } = await api.patch(`/restaurants/admin/status`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.restaurant || null;
}

export async function apiUpdateRestaurantLogo(logo) {
    const token = getToken();
    if (!token) throw new Error("No token");
    if (!logo) throw new Error("Logo image is required");
    const payload = { logo };
    const { data } = await api.patch(`/restaurants/admin/logo`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.restaurant || null;
}

export async function apiRemoveRestaurantLogo() {
    const token = getToken();
    if (!token) throw new Error("No token");
    const payload = { remove: true };
    const { data } = await api.patch(`/restaurants/admin/logo`, payload, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return data?.restaurant || null;
}
