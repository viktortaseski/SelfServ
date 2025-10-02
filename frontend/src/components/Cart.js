import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./components-style/App.css";
import "./components-style/cart.css";
import binIcon from "../assets/other-images/bin.svg";
import OrderSummary from "./cart/OrderSummary";
import MyOrders from "./cart/MyOrders";
import MenuItem from "./menu/MenuItem";
import ViewOrderPill from "./common/ViewOrderPill";
import { fmtMKD } from "./common/format";

const SUGGESTION_NAMES = ["Water", "Brownie", "Ice Cream"];

const tableNum = (name) => {
    const m = String(name || "").match(/\d+/);
    return m ? m[0].padStart(2, "0") : null;
};
const tableLabel = (name) => {
    const num = tableNum(name);
    return num ? `Table ${num}` : null;
};

const MY_ORDERS_KEY = "myOrders";

function loadMyOrders() {
    try {
        const raw = localStorage.getItem(MY_ORDERS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function persistMyOrders(list) {
    try {
        localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list));
    } catch { }
}

function Cart({
    cart = [],
    tableToken,
    tableName,
    addToCart,
    removeFromCart,
    clearCart,
    notify,
}) {
    const TIP_PRESETS = [0, 50, 100];
    const [tipAmount, setTipAmount] = useState(0);
    const [note, setNote] = useState("");

    const [isPlacing, setIsPlacing] = useState(false);
    const [orderSummary, setOrderSummary] = useState(null);

    const [showMyOrders, setShowMyOrders] = useState(false);
    const [myOrders, setMyOrders] = useState(() => loadMyOrders());

    const [suggestions, setSuggestions] = useState([]);

    const qtyById = useMemo(() => {
        const m = new Map();
        (cart || []).forEach((it) => {
            const prev = m.get(it.id) || 0;
            m.set(it.id, prev + (Number(it.quantity) || 0));
        });
        return m;
    }, [cart]);

    useEffect(() => {
        let mounted = true;
        api
            .get("/menu")
            .then((res) => {
                if (!mounted) return;
                const all = Array.isArray(res.data) ? res.data : [];
                const picked = [];
                for (const name of SUGGESTION_NAMES) {
                    const it = all.find(
                        (x) => (x.name || "").toLowerCase() === name.toLowerCase()
                    );
                    if (it) picked.push(it);
                }
                setSuggestions(picked.slice(0, 3));
            })
            .catch(() => setSuggestions([]));
        return () => {
            mounted = false;
        };
    }, []);

    const itemsCount = useMemo(
        () => cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        [cart]
    );

    const subtotal = useMemo(
        () =>
            (cart || []).reduce(
                (sum, item) =>
                    sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
                0
            ),
        [cart]
    );

    const total = useMemo(
        () => subtotal + (Number(tipAmount) || 0),
        [subtotal, tipAmount]
    );

    const handleCustomTip = () => {
        const raw = window.prompt("Enter tip amount (MKD):", String(tipAmount || 0));
        if (raw == null) return;
        const v = Math.max(0, Math.round(Number(raw) || 0));
        setTipAmount(v);
    };

    const handleClearAll = () => {
        if (!cart.length) return;
        const ok = window.confirm("Clear all items from your order?");
        if (!ok) return;

        if (typeof clearCart === "function") clearCart();
        else {
            cart.forEach((item) => {
                const q = Number(item.quantity) || 0;
                for (let i = 0; i < q; i++) removeFromCart(item);
            });
        }
        if (typeof notify === "function") notify("All items removed.");
    };

    const handleCheckout = async () => {
        if (!cart.length) return;
        if (!tableToken) {
            alert("Missing or expired access token. Please scan the table QR again.");
            return;
        }

        const purchasedItems = (cart || []).map((i) => ({
            id: i.id,
            name: i.name,
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 0,
            image_url: i.image_url,
        }));
        const sub = purchasedItems.reduce((s, it) => s + it.price * it.quantity, 0);
        const tipVal = Math.round(Number(tipAmount) || 0);
        const totalVal = sub + tipVal;

        setIsPlacing(true);
        setOrderSummary({
            orderId: null,
            tableName: tableName || null,
            items: purchasedItems,
            subtotal: sub,
            tip: tipVal,
            total: totalVal,
        });

        try {
            const trimmed = (note || "").trim();
            const message = trimmed.length ? trimmed.slice(0, 200) : null;

            const payload = {
                accessToken: tableToken,
                items: cart,
                tip: tipVal,
                message,
            };

            // Customer endpoint only
            const res = await api.post("/orders/customer", payload);
            const { orderId } = res.data || {};

            const finalSummary = {
                orderId: orderId || null,
                tableName: tableName || null,
                items: purchasedItems,
                subtotal: sub,
                tip: tipVal,
                total: totalVal,
                createdAt: new Date().toISOString(),
            };
            setOrderSummary(finalSummary);

            if (orderId) {
                setMyOrders((prev) => {
                    const updated = [finalSummary, ...(prev || [])].slice(0, 20);
                    persistMyOrders(updated);
                    return updated;
                });
            }

            if (typeof clearCart === "function") clearCart();

            if (typeof notify === "function") {
                const text = orderId ? `Order placed! ID: ${orderId}` : "Order placed!";
                notify(text, 6000);
            }

            setNote("");
            setTipAmount(0);
            localStorage.removeItem("accessToken");
        } catch (err) {
            const msg =
                err?.response?.data?.error || err?.message || "Something went wrong";
            console.error(err);
            if (typeof notify === "function") notify(msg, 6000);
            else alert(msg);
        } finally {
            setIsPlacing(false);
        }
    };

    if (showMyOrders) {
        return (
            <MyOrders
                orders={myOrders}
                onBack={() => setShowMyOrders(false)}
            />
        );
    }

    if (orderSummary) {
        return (
            <OrderSummary
                orderSummary={orderSummary}
                isPlacing={isPlacing}
            />
        );
    }

    return (
        <div className="menu-container cart-container">
            {tableName && (
                <div
                    className="table-banner"
                    style={{ paddingBottom: "", marginBottom: "6px", textTransform: "capitalize" }}
                >
                    Ordering for {tableLabel(tableName)}
                </div>
            )}

            <div className="cart-header-row">
                <h3 className="page-head" style={{ margin: 0 }}>My Order</h3>
                <div className="header-actions">
                    <div className="pill-wrap">
                        <button
                            type="button"
                            className="pill-btn"
                            onClick={() => setShowMyOrders(true)}
                            aria-label="Open My Orders"
                        >
                            Past Orders
                        </button>
                    </div>

                    <div className="clear-all-wrap">
                        <button
                            type="button"
                            className="clear-all-btn"
                            onClick={handleClearAll}
                            aria-label="Clear all items in the order"
                        >
                            <img src={binIcon} alt="" className="clear-all-icon" draggable="false" />
                            <span>Clear All</span>
                        </button>
                    </div>
                </div>
            </div>

            {(!cart || cart.length === 0) && (
                <p className="empty-cart">Your cart is empty.</p>
            )}

            <ul className="menu-list menu-list--full">
                {cart.map((item) => (
                    <MenuItem
                        key={item.id}
                        item={item}
                        qty={Number(item.quantity) || 0}
                        onAdd={addToCart}
                        onRemove={removeFromCart}
                        className="menu-item-cart"
                    />
                ))}
            </ul>

            {cart.length > 0 && (
                <>
                    <div className="total-row">
                        <span className="total-label">Total</span>
                        <span className="total-amount">{fmtMKD(total)}</span>
                    </div>

                    <div className="block">
                        <div className="block-title">Add Tip</div>
                        <div className="tip-buttons">
                            {TIP_PRESETS.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    className={`tip-chip ${tipAmount === amt ? "is-active" : ""}`}
                                    onClick={() => setTipAmount(amt)}
                                >
                                    {amt} MKD
                                </button>
                            ))}
                            <button type="button" className="tip-chip" onClick={handleCustomTip}>
                                Custom
                            </button>
                        </div>
                    </div>

                    <div className="block">
                        <div className="block-title">Add Note</div>
                        <input
                            className="note-input"
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Message for the waiter"
                            maxLength={200}
                            inputMode="text"
                        />
                    </div>

                    <Suggestions
                        suggestions={suggestions}
                        qtyById={qtyById}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                    />

                    <ViewOrderPill
                        count={itemsCount}
                        text={isPlacing ? "Placing…" : "Place Order"}
                        totalText={fmtMKD(total)}
                        onClick={handleCheckout}
                        disabled={isPlacing}
                    />
                </>
            )}
        </div>
    );
}

function Suggestions({ suggestions, qtyById, addToCart, removeFromCart }) {
    if (!suggestions.length) return null;
    return (
        <div className="block" style={{ marginTop: "30px" }}>
            <div className="block-title" style={{ textAlign: "center" }}>You also may like</div>
            <ul className="menu-list menu-list--full">
                {suggestions.map((item) => {
                    const qty = qtyById.get(item.id) || 0;
                    return (
                        <MenuItem
                            key={`s-${item.id}`}
                            item={item}
                            qty={qty}
                            onAdd={addToCart}
                            onRemove={removeFromCart}
                            className="menu-item-cart"
                        />
                    );
                })}
            </ul>
        </div>
    );
}

export default Cart;
