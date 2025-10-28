import { useCallback, useEffect, useMemo, useState } from "react";
import WaiterTableSelect from "./WaiterTableSelect";
import WaiterMenu from "./WaiterMenu";
import WaiterSummary from "./WaiterSummary";
import WaiterNav from "./WaiterNav";
import WaiterNoteModal from "./WaiterNoteModal";
import WaiterOrderManager from "./WaiterOrderManager";
import {
    fetchWaiterTables,
    fetchWaiterMenu,
    createWaiterOrder,
    mergeTableOrders,
    closeTableOrders,
    fetchWaiterOrders,
    reprintWaiterOrder,
    updateWaiterOrderStatus,
} from "./waiterApi";
import "./waiter.css";

const STEPS = ["tables", "items", "summary"];

function createNoteEditorState() {
    return {
        open: false,
        itemId: null,
        itemName: "",
        value: "",
    };
}

function formatPrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0 MKD";
    return `${Math.round(num)} MKD`;
}

function WaiterApp({ user, onLogout }) {
    const [stepIdx, setStepIdx] = useState(0);
    const [tables, setTables] = useState([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [tablesError, setTablesError] = useState("");
    const [selectedTableId, setSelectedTableId] = useState(null);

    const [menuItems, setMenuItems] = useState([]);
    const [loadingMenu, setLoadingMenu] = useState(false);
    const [menuError, setMenuError] = useState("");

    const [searchText, setSearchText] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");

    const [orderLines, setOrderLines] = useState(() => new Map());

    const [accountOpen, setAccountOpen] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [tableActionBusy, setTableActionBusy] = useState(false);
    const [manageOrdersOpen, setManageOrdersOpen] = useState(false);
    const [waiterOrders, setWaiterOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [ordersError, setOrdersError] = useState("");
    const [ordersFilter, setOrdersFilter] = useState("open");
    const [orderActionBusyId, setOrderActionBusyId] = useState(null);

    const [noteEditor, setNoteEditor] = useState(createNoteEditorState);

    const restaurantId = useMemo(() => {
        if (!user) return null;
        return user.restaurant_id || user.restaurantId || null;
    }, [user]);

    const step = STEPS[stepIdx] || "tables";

    const selectedTable = useMemo(() => {
        if (!selectedTableId) return null;
        return tables.find((t) => t.id === selectedTableId) || null;
    }, [selectedTableId, tables]);

    const orderItems = useMemo(() => Array.from(orderLines.values()), [orderLines]);

    const orderTotal = useMemo(
        () =>
            orderItems.reduce(
                (sum, line) => sum + (Number(line.item.price) || 0) * line.quantity,
                0
            ),
        [orderItems]
    );

    const categories = useMemo(() => {
        const map = new Map();
        for (const item of menuItems) {
            const slug = item.category || item.category_slug || "other";
            const readable =
                item.category_name ||
                slug
                    .replace(/[-_]/g, " ")
                    .replace(/\b\w/g, (ch) => ch.toUpperCase());
            if (!map.has(slug)) {
                map.set(slug, {
                    slug,
                    name: readable,
                });
            }
        }
        return Array.from(map.values());
    }, [menuItems]);

    const canGoBack = stepIdx > 0 && !tableActionBusy && !submitting;
    const canGoForward =
        step === "tables"
            ? !!selectedTable && !tableActionBusy
            : step === "items"
            ? orderItems.length > 0 && !tableActionBusy
            : step === "summary"
            ? orderItems.length > 0 && !submitting && !tableActionBusy
            : false;

    const loadTables = useCallback(async () => {
        setLoadingTables(true);
        setTablesError("");
        try {
            const data = await fetchWaiterTables();
            setTables(Array.isArray(data) ? data : []);
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                "Unable to load tables. Please try again.";
            setTablesError(msg);
        } finally {
            setLoadingTables(false);
        }
    }, []);

    const loadMenu = useCallback(async () => {
        setLoadingMenu(true);
        setMenuError("");
        try {
            const result = await fetchWaiterMenu({ restaurantId });
            if (Array.isArray(result?.items)) {
                setMenuItems(result.items);
            } else if (Array.isArray(result)) {
                // fallback if API returns array directly
                setMenuItems(result);
            } else {
                setMenuItems([]);
            }
            if (Array.isArray(result?.categories) && result.categories.length) {
                // Normalize categories while keeping menu-derived as fallback
                setActiveCategory((prev) => {
                    if (prev === "all") return prev;
                    const exists = result.categories.some((cat) => cat.slug === prev);
                    return exists ? prev : "all";
                });
            }
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                "Unable to load menu. Please try again.";
            setMenuError(msg);
            setMenuItems([]);
        } finally {
            setLoadingMenu(false);
        }
    }, [restaurantId]);

    const loadOrders = useCallback(
        async (statusValue) => {
            const statusParam = statusValue || ordersFilter || "open";
            setLoadingOrders(true);
            setOrdersError("");
            try {
                const data = await fetchWaiterOrders({ status: statusParam });
                setWaiterOrders(Array.isArray(data) ? data : []);
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    err?.message ||
                    "Unable to load orders. Please try again.";
                setOrdersError(msg);
                setWaiterOrders([]);
            } finally {
                setLoadingOrders(false);
            }
        },
        [ordersFilter]
    );

    const handleMergeOrders = useCallback(
        async (table) => {
            if (!table || !table.id) return;
            setTableActionBusy(true);
            setFeedback(null);
            try {
                const result = await mergeTableOrders(table.id);
                const mergedCount =
                    Number(result?.mergedOrderCount) ||
                    (Array.isArray(result?.mergedOrderIds) ? result.mergedOrderIds.length : 0);
                let message = "No additional open orders to merge for this table.";
                if (mergedCount > 0) {
                    const totalOrders =
                        Number(result?.initialOpenOrderCount) || mergedCount + 1;
                    const targetId = result?.mergedIntoOrderId || table.id;
                    const tableLabel = table.name || `Table ${table.id}`;
                    message = `Merged ${totalOrders} open ${
                        totalOrders === 1 ? "order" : "orders"
                    } for ${tableLabel} into #${targetId}.`;
                }
                setFeedback({
                    kind: "success",
                    message,
                });
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to merge orders for this table.";
                setFeedback({
                    kind: "error",
                    message: msg,
                });
            } finally {
                try {
                    await loadTables();
                } catch {
                    // ignore refresh failures
                }
                setTableActionBusy(false);
            }
        },
        [loadTables]
    );

    const handleCloseOrders = useCallback(
        async (table) => {
            if (!table || !table.id) return;
            setTableActionBusy(true);
            setFeedback(null);
            try {
                const result = await closeTableOrders(table.id);
                const closedCount =
                    Number(result?.closedCount) ||
                    (Array.isArray(result?.closedOrderIds) ? result.closedOrderIds.length : 0);
                const message =
                    closedCount > 0
                        ? `Closed ${closedCount} open ${
                              closedCount === 1 ? "order" : "orders"
                          } for ${table.name || `Table ${table.id}`}.`
                        : "No open orders to close for this table.";
                setFeedback({
                    kind: "success",
                    message,
                });
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to close orders for this table.";
                setFeedback({
                    kind: "error",
                    message: msg,
                });
            } finally {
                try {
                    await loadTables();
                } catch {
                    // ignore refresh failures
                }
                setTableActionBusy(false);
            }
        },
        [loadTables]
    );

    const handleManageOrders = useCallback(() => {
        setAccountOpen(false);
        setManageOrdersOpen(true);
    }, []);

    const handleCloseOrdersPanel = useCallback(() => {
        setManageOrdersOpen(false);
    }, []);

    const handleOrdersFilterChange = useCallback((value) => {
        const next = value || "open";
        setOrdersFilter(next);
    }, []);

    const handleOrdersRefresh = useCallback(() => {
        loadOrders(ordersFilter);
    }, [loadOrders, ordersFilter]);

    const handleReprintExistingOrder = useCallback(
        async (order) => {
            if (!order || !order.id) return;
            setOrderActionBusyId(order.id);
            setFeedback(null);
            try {
                await reprintWaiterOrder(order.id);
                setFeedback({
                    kind: "success",
                    message: `Order #${order.id} sent to the printer again.`,
                });
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to reprint this order.";
                setFeedback({
                    kind: "error",
                    message: msg,
                });
            } finally {
                await loadOrders(ordersFilter);
                setOrderActionBusyId(null);
            }
        },
        [loadOrders, ordersFilter]
    );

    const handleMarkOrderPaid = useCallback(
        async (order) => {
            if (!order || !order.id) return;
            setOrderActionBusyId(order.id);
            setFeedback(null);
            try {
                await updateWaiterOrderStatus(order.id, "paid");
                const tableLabel =
                    order.tableName || (order.tableId ? `Table ${order.tableId}` : "this table");
                setFeedback({
                    kind: "success",
                    message: `Order #${order.id} marked as paid for ${tableLabel}.`,
                });
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to update the order status.";
                setFeedback({
                    kind: "error",
                    message: msg,
                });
            } finally {
                setOrderActionBusyId(null);
                await loadOrders(ordersFilter);
                try {
                    await loadTables();
                } catch {
                    // ignore table refresh failures
                }
            }
        },
        [loadOrders, ordersFilter, loadTables]
    );

    const resetOrder = useCallback(() => {
        setOrderLines(new Map());
        setSearchText("");
        setActiveCategory("all");
    }, []);

    useEffect(() => {
        loadTables();
    }, [loadTables]);

    useEffect(() => {
        if (step === "items" && menuItems.length === 0 && !loadingMenu) {
            loadMenu();
        }
    }, [step, menuItems.length, loadingMenu, loadMenu]);

    useEffect(() => {
        if (!manageOrdersOpen) return;
        loadOrders(ordersFilter);
    }, [manageOrdersOpen, ordersFilter, loadOrders]);

    const setStep = useCallback(
        (next) => {
            const idx = STEPS.indexOf(next);
            if (idx === -1) return;
            setStepIdx(idx);
        },
        [setStepIdx]
    );

    const handleSelectTable = useCallback(
        (tableId) => {
            setSelectedTableId(tableId);
            if (step === "tables") {
                setStep("items");
            }
        },
        [step, setStep]
    );

    const adjustItemQuantity = useCallback((item, delta) => {
        if (!item || !item.id || !Number.isFinite(delta)) return;
        setOrderLines((prev) => {
            const next = new Map(prev);
            const existing = next.get(item.id) || {
                item,
                quantity: 0,
                note: "",
            };
            const newQty = Math.max(0, existing.quantity + delta);
            if (newQty <= 0) {
                next.delete(item.id);
            } else {
                next.set(item.id, {
                    ...existing,
                    item,
                    quantity: newQty,
                });
            }
            return next;
        });
    }, []);

    const incrementItem = useCallback(
        (item) => adjustItemQuantity(item, 1),
        [adjustItemQuantity]
    );
    const decrementItem = useCallback(
        (item) => adjustItemQuantity(item, -1),
        [adjustItemQuantity]
    );

    const setItemNote = useCallback((itemId, note) => {
        if (!itemId) return;
        setOrderLines((prev) => {
            const next = new Map(prev);
            const existing = next.get(itemId);
            if (!existing) return prev;
            next.set(itemId, {
                ...existing,
                note: note || "",
            });
            return next;
        });
    }, []);

    const openNoteEditor = useCallback((item, note) => {
        if (!item || !item.id) return;
        setAccountOpen(false);
        setNoteEditor({
            open: true,
            itemId: item.id,
            itemName: item.name || "",
            value: note || "",
        });
    }, []);

    const closeNoteEditor = useCallback(() => {
        setNoteEditor(createNoteEditorState());
    }, []);

    const saveNoteEditor = useCallback(() => {
        setNoteEditor((prev) => {
            if (prev.open && prev.itemId) {
                setItemNote(prev.itemId, prev.value);
            }
            return createNoteEditorState();
        });
    }, [setItemNote]);

    const submitOrder = useCallback(async () => {
        if (!selectedTable || orderItems.length === 0) return;
        setSubmitting(true);
        setSubmitError("");
        setFeedback(null);
        try {
            const payload = {
                tableId: selectedTable.id,
                items: orderItems.map((line) => ({
                    id: line.item.id,
                    quantity: line.quantity,
                    note: line.note || "",
                })),
            };
            await createWaiterOrder(payload);
            setFeedback({
                kind: "success",
                message: `Order for ${selectedTable.name || `Table ${selectedTable.id}`} submitted.`,
            });
            resetOrder();
            setSelectedTableId(null);
            setStep("tables");
            loadTables();
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                "Could not submit the order. Please retry.";
            setSubmitError(msg);
            setFeedback({
                kind: "error",
                message: msg,
            });
        } finally {
            setSubmitting(false);
        }
    }, [loadTables, orderItems, resetOrder, selectedTable, setStep]);

    const goBack = useCallback(() => {
        setAccountOpen(false);
        if (stepIdx === 0) return;
        if (stepIdx === 1) {
            setStep("tables");
        } else if (stepIdx === 2) {
            setStep("items");
        }
    }, [stepIdx, setStep]);

    const goForward = useCallback(() => {
        setAccountOpen(false);
        if (!canGoForward) return;
        if (step === "tables" && selectedTable) {
            setStep("items");
            return;
        }
        if (step === "items" && orderItems.length > 0) {
            setStep("summary");
            return;
        }
        if (step === "summary") {
            submitOrder();
        }
    }, [canGoForward, step, selectedTable, orderItems.length, setStep, submitOrder]);

    const goHome = useCallback(() => {
        setAccountOpen(false);
        setStep("tables");
        setSelectedTableId(null);
        resetOrder();
    }, [resetOrder, setStep]);

    const toggleAccount = useCallback(() => {
        setAccountOpen((prev) => !prev);
    }, []);

    return (
        <div className="waiter-app">
            <div className="waiter-main">
                {feedback?.message ? (
                    <div
                        className={`waiter-feedback ${
                            feedback.kind === "error" ? "waiter-feedback--error" : "waiter-feedback--success"
                        }`}
                    >
                        {feedback.message}
                    </div>
                ) : null}

                {step === "tables" ? (
                    <WaiterTableSelect
                        user={user}
                        tables={tables}
                        selectedTableId={selectedTableId}
                        onSelectTable={handleSelectTable}
                        onRefresh={loadTables}
                        loading={loadingTables}
                        error={tablesError}
                    />
                ) : null}

                {step === "items" ? (
                    <WaiterMenu
                        table={selectedTable}
                        items={menuItems}
                        loading={loadingMenu}
                        error={menuError}
                        search={searchText}
                        onSearchChange={setSearchText}
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        orderLines={orderLines}
                        onIncrease={incrementItem}
                        onDecrease={decrementItem}
                        onRequestNote={openNoteEditor}
                        onMergeOrders={handleMergeOrders}
                        onCloseOrders={handleCloseOrders}
                        actionsBusy={tableActionBusy}
                    />
                ) : null}

                {step === "summary" ? (
                    <WaiterSummary
                        table={selectedTable}
                        items={orderItems}
                        total={orderTotal}
                        formatPrice={formatPrice}
                        onIncrease={incrementItem}
                        onDecrease={decrementItem}
                        onRequestNote={openNoteEditor}
                        submitting={submitting}
                        error={submitError}
                    />
                ) : null}
            </div>

            <WaiterNav
                step={step}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={goBack}
                onForward={goForward}
                onHome={goHome}
                onToggleAccount={toggleAccount}
                accountOpen={accountOpen}
                onLogout={onLogout}
                onManageOrders={handleManageOrders}
                disableForward={(step === "summary" && submitting) || tableActionBusy}
            />

            <WaiterOrderManager
                open={manageOrdersOpen}
                orders={waiterOrders}
                loading={loadingOrders}
                error={ordersError}
                filter={ordersFilter}
                onChangeFilter={handleOrdersFilterChange}
                onRefresh={handleOrdersRefresh}
                onClose={handleCloseOrdersPanel}
                onReprint={handleReprintExistingOrder}
                onMarkPaid={handleMarkOrderPaid}
                busyOrderId={orderActionBusyId}
            />

            <WaiterNoteModal
                open={noteEditor.open}
                itemName={noteEditor.itemName}
                value={noteEditor.value}
                onChange={(val) => setNoteEditor((prev) => ({ ...prev, value: val }))}
                onClose={closeNoteEditor}
                onSave={saveNoteEditor}
            />
        </div>
    );
}

export default WaiterApp;
