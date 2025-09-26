// src/components/Cart.js
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./components-style/App.css";
import "./components-style/cart.css";
import binIcon from "../assets/other-images/bin.svg";

const PLACEHOLDER =
    "https://dummyimage.com/160x120/eaeaea/555&text=%F0%9F%8D%BA";

// helper names we want as suggestions
const SUGGESTION_NAMES = ["Water", "Brownie", "Ice Cream"];

function Cart({
    cart = [],
    tableToken,          // short-lived access token
    tableName,           // shown above "Your Order"
    addToCart,
    removeFromCart,
    isWaiter,
    clearCart,
    notify,
}) {
    const TIP_PRESETS = [0, 50, 100];
    const [tipAmount, setTipAmount] = useState(0);
    const [note, setNote] = useState("");

    // suggestions state
    const [suggestions, setSuggestions] = useState([]);

    // quantity lookup for showing qty controls on suggestions
    const qtyById = useMemo(() => {
        const m = new Map();
        (cart || []).forEach((it) => {
            const prev = m.get(it.id) || 0;
            m.set(it.id, prev + (Number(it.quantity) || 0));
        });
        return m;
    }, [cart]);

    // fetch menu once and pick the 3 suggestions by name
    useEffect(() => {
        let mounted = true;
        api
            .get("/menu")
            .then((res) => {
                if (!mounted) return;
                const all = Array.isArray(res.data) ? res.data : [];
                // pick by exact names; fall back gracefully if a name is missing
                const picked = [];
                for (const name of SUGGESTION_NAMES) {
                    const it = all.find((x) => (x.name || "").toLowerCase() === name.toLowerCase());
                    if (it) picked.push(it);
                }
                setSuggestions(picked.slice(0, 3));
            })
            .catch(() => setSuggestions([]));
        return () => {
            mounted = false;
        };
    }, []);

    const fmtMKD = (n) => `${Math.round(Number(n || 0))} MKD`;

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

        if (typeof clearCart === "function") {
            clearCart();
        } else {
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

        try {
            const trimmed = (note || "").trim();
            const message = trimmed.length ? trimmed.slice(0, 200) : null;

            const payload = {
                accessToken: tableToken, // short-lived token
                items: cart,
                tip: Math.round(Number(tipAmount) || 0),
                message,
            };

            const res = await (isWaiter
                ? api.post("/orders/waiter", payload, { withCredentials: true })
                : api.post("/orders/customer", payload));

            const { orderId } = res.data || {};

            if (typeof clearCart === "function") clearCart();

            const text = orderId ? `Order placed! ID: ${orderId}` : "Order placed!";
            if (typeof notify === "function") notify(text, 8000);
            else alert(text);

            setNote("");
            setTipAmount(0);
            localStorage.removeItem("accessToken"); // force rescan next time
        } catch (err) {
            const msg =
                err?.response?.data?.error || err?.message || "Something went wrong";
            console.error(err);
            if (typeof notify === "function") notify(msg, 6000);
            else alert(msg);
        }
    };

    return (
        <div className="menu-container cart-container">
            {/* Centered table name banner */}
            {tableName && (
                <div
                    className="table-banner"
                    style={{ padding: "6px 0", marginBottom: "6px", textTransform: "capitalize" }}
                >
                    {tableName}
                </div>
            )}

            {/* Header row: title + Clear All */}
            <div className="cart-header-row">
                <h3 className="page-head" style={{ margin: 0 }}>
                    Your Order
                </h3>
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

            {(!cart || cart.length === 0) && (
                <p className="empty-cart">Your cart is empty</p>
            )}

            {/* Cart items */}
            <ul className="menu-list menu-list--full">
                {cart.map((item) => (
                    <li key={item.id} className="menu-item menu-item-cart">
                        <img
                            src={item.image_url || PLACEHOLDER}
                            alt={item.name}
                            className="thumb"
                            loading="lazy"
                        />
                        <div className="item-info" onClick={() => addToCart(item)}>
                            <span className="item-name">{item.name}</span>
                            <span className="item-price">{fmtMKD(item.price)}</span>
                        </div>

                        <div className="qty-controls" aria-label="Quantity controls">
                            <button
                                className="qty-btn"
                                aria-label={`Remove one ${item.name}`}
                                onClick={() => removeFromCart(item)}
                            >
                                &minus;
                            </button>
                            <span className="qty-num" aria-live="polite">
                                {item.quantity}
                            </span>
                            <button
                                className="qty-btn"
                                aria-label={`Add one more ${item.name}`}
                                onClick={() => addToCart(item)}
                            >
                                +
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {cart.length > 0 && (
                <>
                    {/* Totals */}
                    <div className="total-row">
                        <span className="total-label">Total</span>
                        <span className="total-amount">{fmtMKD(total)}</span>
                    </div>

                    {/* Tip */}
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

                    {/* Note */}
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

                    {/* ---- Suggestions ---- */}
                    {suggestions.length > 0 && (
                        <div className="block">
                            <div className="block-title">You also may like</div>
                            <ul className="menu-list menu-list--full">
                                {suggestions.map((item) => {
                                    const qty = qtyById.get(item.id) || 0;
                                    return (
                                        <li key={`s-${item.id}`} className="menu-item menu-item-cart">
                                            <img
                                                src={item.image_url || PLACEHOLDER}
                                                alt={item.name}
                                                className="thumb"
                                                loading="lazy"
                                            />
                                            <div className="item-info" onClick={() => addToCart(item)}>
                                                <span className="item-name">{item.name}</span>
                                                <span className="item-price">{fmtMKD(item.price)}</span>
                                            </div>

                                            {qty > 0 ? (
                                                <div className="qty-controls" aria-label="Quantity controls">
                                                    <button
                                                        className="qty-btn"
                                                        aria-label={`Remove one ${item.name}`}
                                                        onClick={() => removeFromCart(item)}
                                                    >
                                                        &minus;
                                                    </button>
                                                    <span className="qty-num" aria-live="polite">
                                                        {qty}
                                                    </span>
                                                    <button
                                                        className="qty-btn"
                                                        aria-label={`Add one more ${item.name}`}
                                                        onClick={() => addToCart(item)}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    className="add-btn"
                                                    aria-label={`Add ${item.name} to order`}
                                                    onClick={() => addToCart(item)}
                                                >
                                                    +
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {/* Place order */}
                    <button className="view-order-pill" onClick={handleCheckout}>
                        <span className="pill-left">
                            <span className="pill-count">{itemsCount}</span>
                            <span className="pill-text">Place Order</span>
                        </span>
                        <span className="pill-total">{fmtMKD(total)}</span>
                    </button>
                </>
            )}
        </div>
    );
}

export default Cart;
