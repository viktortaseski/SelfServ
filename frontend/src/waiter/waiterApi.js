import api from "../api";
import { getToken } from "../admin/dashboardApi";

function buildAuthHeaders() {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    return {
        Authorization: `Bearer ${token}`,
    };
}

function normalizeMenuItem(raw) {
    if (!raw) return null;
    return {
        ...raw,
        id: Number(raw.id),
        price: Number(raw.price) || 0,
        category: raw.category || raw.category_slug || raw.categoryId || "other",
        category_name: raw.category_name || raw.categoryName || null,
    };
}

function normalizeCategory(raw) {
    if (!raw) return null;
    const slug =
        raw.slug ||
        (raw.name ? String(raw.name).toLowerCase().replace(/\s+/g, "-") : null);
    return {
        slug,
        name: raw.name || raw.category_name || slug || "Category",
    };
}

function normalizeTable(row) {
    if (!row) return null;
    const id = Number(row.id);
    const openOrders = Number(
        row.open_orders ?? row.openOrders ?? row.active_orders ?? 0
    );
    const status =
        row.status ||
        (openOrders > 0
            ? `${openOrders} open ${openOrders === 1 ? "order" : "orders"}`
            : "Available");
    return {
        id,
        name: row.name || `Table ${id}`,
        openOrders,
        status,
    };
}

export async function fetchWaiterTables() {
    const headers = buildAuthHeaders();
    const { data } = await api.get("/orders/waiter/tables", { headers });
    const rows = Array.isArray(data) ? data : Array.isArray(data?.tables) ? data.tables : [];
    return rows.map(normalizeTable).filter((row) => row && Number.isFinite(row.id));
}

export async function fetchWaiterMenu({ restaurantId } = {}) {
    const params = {};
    if (restaurantId) {
        params.restaurantId = restaurantId;
    }

    const [menuRes, catRes] = await Promise.allSettled([
        api.get("/menu", { params }),
        api.get("/menu/categories", { params }),
    ]);

    const items =
        menuRes.status === "fulfilled" && Array.isArray(menuRes.value.data)
            ? menuRes.value.data
            : [];
    const categories =
        catRes.status === "fulfilled" && Array.isArray(catRes.value.data)
            ? catRes.value.data
            : [];

    return {
        items: items.map(normalizeMenuItem).filter(Boolean),
        categories: categories.map(normalizeCategory).filter(Boolean),
    };
}

export async function createWaiterOrder({ tableId, items }) {
    const headers = buildAuthHeaders();
    const payload = {
        tableId,
        items: Array.isArray(items)
            ? items.map((item) => ({
                  id: Number(item.id),
                  quantity: Number(item.quantity) || 0,
                  note: item.note || "",
              }))
            : [],
    };
    const { data } = await api.post("/orders/waiter", payload, { headers });
    return data;
}

export async function mergeTableOrders(tableId) {
    const headers = buildAuthHeaders();
    const payload = { tableId: Number(tableId) || tableId };
    const { data } = await api.post("/orders/waiter/merge", payload, { headers });
    return data;
}

export async function closeTableOrders(tableId) {
    const headers = buildAuthHeaders();
    const payload = { tableId: Number(tableId) || tableId };
    const { data } = await api.post("/orders/waiter/close", payload, { headers });
    return data;
}
