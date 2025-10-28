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

function normalizeOrderItem(raw) {
    if (!raw) return { name: "", quantity: 0, price: 0, note: null };
    return {
        name: raw.name || "",
        quantity: Number(raw.quantity || 0),
        price: Number(raw.price || 0),
        note: raw.note || null,
    };
}

function normalizeWaiterOrder(raw) {
    if (!raw) return null;
    const id = Number(raw.id);
    const tableId =
        raw.table_id != null && Number.isFinite(Number(raw.table_id))
            ? Number(raw.table_id)
            : null;
    return {
        id,
        tableId,
        tableName: raw.table_name || (tableId ? `Table ${tableId}` : "Unassigned"),
        status: raw.status || "open",
        subtotal: Number(raw.subtotal || 0),
        tip: Number(raw.tip || 0),
        total: Number(raw.total || 0),
        createdAt: raw.created_at || raw.createdAt || null,
        updatedAt: raw.updated_at || raw.updatedAt || null,
        items: Array.isArray(raw.items) ? raw.items.map(normalizeOrderItem) : [],
        printCount: Number(raw.print_count || raw.printCount || 0),
        reprintAvailable: Boolean(
            raw.reprint_available ?? raw.reprintAvailable ?? (Number(raw.print_count || 0) > 0)
        ),
    };
}

export async function fetchWaiterOrders({ status, tableId, limit } = {}) {
    const headers = buildAuthHeaders();
    const params = {};
    if (status) params.status = status;
    if (tableId) params.tableId = tableId;
    if (limit) params.limit = limit;

    const { data } = await api.get("/orders/waiter/orders", { headers, params });
    const rows = Array.isArray(data) ? data : Array.isArray(data?.orders) ? data.orders : [];
    return rows.map(normalizeWaiterOrder).filter((order) => order && Number.isFinite(order.id));
}

export async function reprintWaiterOrder(orderId) {
    const headers = buildAuthHeaders();
    const { data } = await api.post(`/orders/waiter/${orderId}/reprint`, {}, { headers });
    return data;
}

export async function updateWaiterOrderStatus(orderId, status) {
    const headers = buildAuthHeaders();
    const payload = { status };
    const { data } = await api.patch(
        `/orders/waiter/${orderId}/status`,
        payload,
        { headers }
    );
    return data;
}
