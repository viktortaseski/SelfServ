import { useCallback, useEffect, useMemo, useState } from "react";
import WaiterTableSelect from "./WaiterTableSelect";
import WaiterMenu from "./WaiterMenu";
import WaiterSummary from "./WaiterSummary";
import WaiterNav from "./WaiterNav";
import WaiterQuickControls from "./WaiterQuickControls";
import WaiterNoteModal from "./WaiterNoteModal";
import WaiterOrdersScreen from "./WaiterOrdersScreen";
import WaiterOrdersControls from "./WaiterOrdersControls";
import WaiterSplitModal from "./WaiterSplitModal";
import { formatTableLabel } from "./tableLabel";
import {
    fetchWaiterTables,
    fetchWaiterMenu,
    createWaiterOrder,
    mergeTableOrders,
    closeTableOrders,
    fetchWaiterOrders,
    reprintWaiterOrder,
    updateWaiterOrderStatus,
    splitWaiterOrder,
    setOrderPriority,
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
    const [selectedItemId, setSelectedItemId] = useState(null);

    const [accountOpen, setAccountOpen] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [tableActionBusy, setTableActionBusy] = useState(false);
    const [manageOrdersOpen, setManageOrdersOpen] = useState(false);
    const [detailsTableId, setDetailsTableId] = useState(null);
    const [waiterOrders, setWaiterOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [ordersError, setOrdersError] = useState("");
    const [ordersFilter, setOrdersFilter] = useState("open");
    const [orderActionBusyId, setOrderActionBusyId] = useState(null);
    const [selectedManageOrder, setSelectedManageOrder] = useState(null);
    const [splitModalOpen, setSplitModalOpen] = useState(false);
    const [splitSubmitting, setSplitSubmitting] = useState(false);

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

    const selectedTableOpenOrders = Number(
        selectedTable?.openOrders ?? selectedTable?.open_orders ?? 0
    );

    const ordersOverlayOpen = manageOrdersOpen || detailsTableId != null;

    const detailsTable = useMemo(() => {
        if (detailsTableId == null) return null;
        return tables.find((t) => t.id === detailsTableId) || null;
    }, [detailsTableId, tables]);

    const restaurantName = user?.restaurant_name || "Restaurant";

    const orderItems = useMemo(() => Array.from(orderLines.values()), [orderLines]);

    const selectedItem = useMemo(() => {
        if (!selectedItemId) return null;
        return menuItems.find((item) => item.id === selectedItemId) || null;
    }, [selectedItemId, menuItems]);

    const selectedLine = selectedItemId ? orderLines.get(selectedItemId) : null;
    const selectedQuantity = selectedLine?.quantity || 0;
    const selectedNote = selectedLine?.note || "";

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

    const canGoBack = ordersOverlayOpen ? true : stepIdx > 0 && !tableActionBusy && !submitting;
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
                const data = await fetchWaiterOrders({
                    status: statusParam,
                    tableId: detailsTableId || undefined,
                });
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
        [ordersFilter, detailsTableId]
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
        setDetailsTableId(null);
        setSelectedManageOrder(null);
        setManageOrdersOpen(true);
    }, []);

    const handleOpenTableDetails = useCallback((table) => {
        if (!table?.id) return;
        setAccountOpen(false);
        setSelectedManageOrder(null);
        setDetailsTableId(table.id);
    }, []);

    const handleCloseTableDetails = useCallback(() => {
        setDetailsTableId(null);
        setSelectedManageOrder(null);
    }, []);

    const handleOrdersFilterChange = useCallback((value) => {
        const next = value || "open";
        setOrdersFilter(next);
        setSelectedManageOrder(null);
    }, []);

    const handleOrdersRefresh = useCallback(() => {
        loadOrders(ordersFilter);
    }, [loadOrders, ordersFilter]);

    const handleMergeSelectedOrder = useCallback(async () => {
        if (!selectedManageOrder?.tableId) return;
        await handleMergeOrders({
            id: selectedManageOrder.tableId,
            name: selectedManageOrder.tableName,
        });
        setSelectedManageOrder(null);
        loadOrders(ordersFilter);
    }, [handleMergeOrders, selectedManageOrder, loadOrders, ordersFilter]);

    const handleOpenSplitOrder = useCallback(() => {
        if (!selectedManageOrder) return;
        setSplitModalOpen(true);
    }, [selectedManageOrder]);

    const handleCloseSplitModal = useCallback(() => {
        setSplitModalOpen(false);
    }, []);

    const handleConfirmSplitOrder = useCallback(
        async (items) => {
            if (!selectedManageOrder?.id) return;
            setSplitSubmitting(true);
            setFeedback(null);
            try {
                await splitWaiterOrder(selectedManageOrder.id, items);
                setFeedback({
                    kind: "success",
                    message: `Split a new check off order #${selectedManageOrder.id}.`,
                });
                setSplitModalOpen(false);
                setSelectedManageOrder(null);
                await loadOrders(ordersFilter);
            } catch (err) {
                const msg =
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to split this order.";
                setFeedback({
                    kind: "error",
                    message: msg,
                });
            } finally {
                setSplitSubmitting(false);
            }
        },
        [selectedManageOrder, loadOrders, ordersFilter]
    );

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

    const handleCloseSelectedOrder = useCallback(async () => {
        if (!selectedManageOrder) return;
        await handleMarkOrderPaid(selectedManageOrder);
        setSelectedManageOrder(null);
    }, [handleMarkOrderPaid, selectedManageOrder]);

    const handleTogglePriority = useCallback(async () => {
        if (!selectedManageOrder?.id) return;
        const orderId = selectedManageOrder.id;
        const nextPriority = !selectedManageOrder.priority;
        setOrderActionBusyId(orderId);
        setFeedback(null);
        try {
            await setOrderPriority(orderId, nextPriority);
            setSelectedManageOrder((prev) =>
                prev && prev.id === orderId ? { ...prev, priority: nextPriority } : prev
            );
            await loadOrders(ordersFilter);
        } catch (err) {
            const msg =
                err?.response?.data?.error ||
                err?.message ||
                "Failed to update priority.";
            setFeedback({
                kind: "error",
                message: msg,
            });
        } finally {
            setOrderActionBusyId(null);
        }
    }, [selectedManageOrder, loadOrders, ordersFilter]);

    const resetOrder = useCallback(() => {
        setOrderLines(new Map());
        setSearchText("");
        setActiveCategory("all");
        setSelectedItemId(null);
    }, []);

    const selectItem = useCallback((item) => {
        setSelectedItemId(item?.id ?? null);
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
        if (!ordersOverlayOpen) return;
        loadOrders(ordersFilter);
    }, [ordersOverlayOpen, ordersFilter, loadOrders]);

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
        if (manageOrdersOpen) {
            setManageOrdersOpen(false);
            return;
        }
        if (detailsTableId != null) {
            handleCloseTableDetails();
            return;
        }
        if (stepIdx === 0) return;
        if (stepIdx === 1) {
            setStep("tables");
        } else if (stepIdx === 2) {
            setStep("items");
        }
    }, [manageOrdersOpen, detailsTableId, handleCloseTableDetails, stepIdx, setStep]);

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
        setManageOrdersOpen(false);
        setDetailsTableId(null);
        setStep("tables");
        setSelectedTableId(null);
        resetOrder();
    }, [resetOrder, setStep]);

    const toggleAccount = useCallback(() => {
        setAccountOpen((prev) => !prev);
    }, []);

    return (
        <div className="waiter-app">
            <header className="waiter-topbar">
                <div className="waiter-topbar__info">
                    {ordersOverlayOpen ? (
                        <h1 className="waiter-topbar__title">
                            {detailsTableId != null
                                ? `${detailsTable ? formatTableLabel(detailsTable) : "Table"} · Details`
                                : "Orders"}
                        </h1>
                    ) : step === "tables" ? (
                        <>
                            <h1 className="waiter-topbar__title">
                                {user?.username || "Staff"}
                            </h1>
                            <p className="waiter-topbar__subtitle">({restaurantName})</p>
                        </>
                    ) : (
                        <h1 className="waiter-topbar__title">
                            {selectedTable ? formatTableLabel(selectedTable) : "ORDER"}
                        </h1>
                    )}
                </div>

                <div className="waiter-topbar__actions">
                    {ordersOverlayOpen ? null : step === "tables" ? (
                        <button
                            type="button"
                            className="waiter-btn waiter-btn--ghost"
                            onClick={loadTables}
                            disabled={loadingTables}
                        >
                            {loadingTables ? "Refreshing…" : "Refresh"}
                        </button>
                    ) : step === "items" && selectedTable ? (
                        <>
                            {selectedTableOpenOrders > 1 ? (
                                <button
                                    type="button"
                                    className="waiter-btn waiter-btn--ghost"
                                    onClick={() => handleMergeOrders(selectedTable)}
                                    disabled={tableActionBusy}
                                >
                                    {tableActionBusy ? "…" : "Merge"}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="waiter-btn waiter-btn--primary"
                                onClick={() => handleOpenTableDetails(selectedTable)}
                            >
                                Details
                            </button>
                        </>
                    ) : null}
                </div>

                <div className="waiter-topbar__account">
                    <button
                        type="button"
                        className="waiter-topbar__hamburger"
                        onClick={toggleAccount}
                        aria-label="Menu"
                    >
                        ☰
                    </button>
                    {accountOpen ? (
                        <div className="waiter-topbar__menu">
                            <button
                                type="button"
                                className="waiter-nav__menu-item waiter-nav__menu-item--danger"
                                onClick={onLogout}
                            >
                                Logout
                            </button>
                        </div>
                    ) : null}
                </div>
            </header>

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

                {ordersOverlayOpen ? (
                    <WaiterOrdersScreen
                        orders={waiterOrders}
                        loading={loadingOrders}
                        error={ordersError}
                        filter={ordersFilter}
                        onChangeFilter={handleOrdersFilterChange}
                        onReprint={handleReprintExistingOrder}
                        onMarkPaid={handleMarkOrderPaid}
                        busyOrderId={orderActionBusyId}
                        selectedOrderId={selectedManageOrder?.id ?? null}
                        onSelectOrder={setSelectedManageOrder}
                    />
                ) : (
                    <>
                        {step === "tables" ? (
                            <WaiterTableSelect
                                tables={tables}
                                selectedTableId={selectedTableId}
                                onSelectTable={handleSelectTable}
                                loading={loadingTables}
                                error={tablesError}
                            />
                        ) : null}

                        {step === "items" ? (
                            <WaiterMenu
                                items={menuItems}
                                loading={loadingMenu}
                                error={menuError}
                                search={searchText}
                                onSearchChange={setSearchText}
                                categories={categories}
                                activeCategory={activeCategory}
                                onCategoryChange={setActiveCategory}
                                orderLines={orderLines}
                                selectedItemId={selectedItemId}
                                onSelectItem={selectItem}
                            />
                        ) : null}

                        {step === "summary" ? (
                            <WaiterSummary
                                items={orderItems}
                                total={orderTotal}
                                selectedItemId={selectedItemId}
                                onSelectItem={selectItem}
                                submitting={submitting}
                                error={submitError}
                            />
                        ) : null}
                    </>
                )}
            </div>

            <div className="waiter-footer-fixed">
                {!ordersOverlayOpen && (step === "items" || step === "summary") ? (
                    <WaiterQuickControls
                        item={selectedItem}
                        quantity={selectedQuantity}
                        onIncrease={() => selectedItem && incrementItem(selectedItem)}
                        onDecrease={() => selectedItem && decrementItem(selectedItem)}
                        onRequestNote={() => selectedItem && openNoteEditor(selectedItem, selectedNote)}
                    />
                ) : null}

                {ordersOverlayOpen ? (
                    <WaiterOrdersControls
                        selectedOrder={selectedManageOrder}
                        onRefresh={handleOrdersRefresh}
                        onMerge={handleMergeSelectedOrder}
                        onSplit={handleOpenSplitOrder}
                        onClose={handleCloseSelectedOrder}
                        onTogglePriority={handleTogglePriority}
                        mergeBusy={tableActionBusy}
                        orderBusy={orderActionBusyId === selectedManageOrder?.id}
                        refreshing={loadingOrders}
                    />
                ) : null}

                <WaiterNav
                    step={step}
                    canGoBack={canGoBack}
                    canGoForward={canGoForward}
                    onBack={goBack}
                    onForward={goForward}
                    onHome={goHome}
                    onManageOrders={handleManageOrders}
                    disableForward={ordersOverlayOpen || (step === "summary" && submitting) || tableActionBusy}
                />
            </div>

            <WaiterNoteModal
                open={noteEditor.open}
                itemName={noteEditor.itemName}
                value={noteEditor.value}
                onChange={(val) => setNoteEditor((prev) => ({ ...prev, value: val }))}
                onClose={closeNoteEditor}
                onSave={saveNoteEditor}
            />

            <WaiterSplitModal
                open={splitModalOpen}
                order={selectedManageOrder}
                onClose={handleCloseSplitModal}
                onConfirm={handleConfirmSplitOrder}
                submitting={splitSubmitting}
            />
        </div>
    );
}

export default WaiterApp;
