import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./components-style/App.css";
import "./components-style/cart.css";
import OrderSummary from "./cart/OrderSummary";
import MyOrders from "./cart/MyOrders";
import Suggestions from "./cart/Suggestions";
import CartItem from "./cart/CartItem";
import PaymentOptions from "./cart/PaymentOptions";
import ViewOrderPill from "./common/ViewOrderPill";
import ConfirmOrderNotice from "./common/ConfirmOrderNotice";
import { fmtMKD } from "./common/format";
import { t } from "../i18n";
import plateImage from "../assets/other-images/plate.svg";
import { verifyWithinRestaurant } from "./common/geofence";

const SUGGESTION_NAMES = ["Water", "Brownie", "Ice Cream"];

const tableNum = (name) => {
    const m = String(name || "").match(/\d+/);
    return m ? m[0].padStart(2, "0") : null;
};
const tableLabel = (name) => {
    const num = tableNum(name);
    return num ? `${t("orders.table")} ${num}` : null;
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
    restaurantGeo = null,
    addToCart,
    removeFromCart,
    clearCart,
    notify,
    activeTab = "current",
    onTabChange,
    onRequestClose,
    isClosing = false,
}) {

    const TIP_PRESETS = [0, 50, 100];
    const [tipAmount, setTipAmount] = useState(0);
    const isPresetTip = TIP_PRESETS.includes(Number(tipAmount));
    const customActive = !isPresetTip && (Number.isFinite(tipAmount) && tipAmount >= 0);

    const [itemNotes, setItemNotes] = useState(() => ({}));
    const setNoteFor = (id, text) =>
        setItemNotes((prev) => ({ ...prev, [id]: text }));


    const [isPlacing, setIsPlacing] = useState(false);
    const [orderSummary, setOrderSummary] = useState(null);

    const [myOrders, setMyOrders] = useState(() => loadMyOrders());

    const [suggestions, setSuggestions] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isEntering, setIsEntering] = useState(true);

    // Toggle a body class so we can hide the navbar + lock scroll without changing App.js
    useEffect(() => {
        const cls = "has-confirm-open";
        if (showConfirm) {
            document.documentElement.classList.add(cls);
            document.body.classList.add(cls);
        } else {
            document.documentElement.classList.remove(cls);
            document.body.classList.remove(cls);
        }
        return () => {
            document.documentElement.classList.remove(cls);
            document.body.classList.remove(cls);
        };
    }, [showConfirm]);

    const isPreviousTab = activeTab === "previous";
    const changeTab = (tab) => {
        if (typeof onTabChange === "function") onTabChange(tab);
    };
    const handleBackClick = () => {
        if (isClosing) return;
        if (typeof onRequestClose === "function") {
            onRequestClose();
            return;
        }
        if (window.history.length > 1) window.history.back();
        else window.location.hash = "#/";
    };

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
        const raw = window.prompt(t("cart.enterTipPrompt"), String(tipAmount || 0));
        if (raw == null) return;
        const v = Math.max(0, Math.round(Number(raw) || 0));
        setTipAmount(v);
    };

    useEffect(() => {
        if (tableName) {
            console.log("[cart] table label:", tableLabel(tableName));
        }
    }, [tableName]);

    useEffect(() => {
        const timer = setTimeout(() => setIsEntering(false), 320);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isClosing) setIsEntering(false);
    }, [isClosing]);


    const actuallyCheckout = async () => {
        if (!cart.length) return;
        if (!tableToken) {
            alert("Missing or expired access token. Please scan the table QR again.");
            return;
        }
        const allowed = await verifyWithinRestaurant(restaurantGeo);
        if (!allowed) {
            return;
        }

        const purchasedItems = (cart || []).map((i) => ({
            id: i.id,
            name: i.name,
            price: Number(i.price) || 0,
            quantity: Number(i.quantity) || 0,
            image_url: i.image_url,
            note: itemNotes[i.id] ? String(itemNotes[i.id]).trim().slice(0, 200) : null,
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

            const payload = {
                accessToken: tableToken,
                items: purchasedItems,
                tip: tipVal,
                message: null,
            };

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

            setTipAmount(0);
            setItemNotes({});

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

    // Confirmation overlay
    if (showConfirm) {
        return (
            <ConfirmOrderNotice
                items={cart}
                subtotal={subtotal}
                tip={tipAmount}
                total={total}
                onCancel={() => setShowConfirm(false)}
                onConfirm={async () => {
                    setShowConfirm(false);
                    await actuallyCheckout();
                }}
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
        <div className={`menu-container cart-container ${isEntering ? "is-sliding-in" : ""} ${isClosing ? "is-sliding-out" : ""}`}>

            {!isPreviousTab ? (
                <>


                    {(!cart || cart.length === 0) ? (
                        <div className="empty-plate">
                            <img src={plateImage} alt="" className="empty-plate-image" />
                            <h3 className="empty-plate-title">{t("cart.plateEmptyTitle")}</h3>
                            <p className="empty-plate-subtitle">{t("cart.plateEmptySubtitle")}</p>
                        </div>
                    ) : (
                        <ul className="cart-list">
                            {cart.map((item) => (
                                <CartItem
                                    key={item.id}
                                    item={item}
                                    qty={Number(item.quantity) || 0}
                                    onAdd={addToCart}
                                    onRemove={removeFromCart}
                                    note={itemNotes[item.id] || ""}
                                    onNoteChange={setNoteFor}
                                />
                            ))}
                        </ul>
                    )}
                </>
            ) : (
                <MyOrders orders={myOrders} onBack={() => changeTab("current")} />
            )}

            {!isPreviousTab && cart.length > 0 && (
                <>

                    <div className="block">
                        <div className="block-title">{t("cart.addTip")}</div>
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

                            {/* Custom chip: becomes active + shows amount when custom is selected */}
                            <button
                                type="button"
                                className={`tip-chip ${customActive ? "is-active" : ""}`}
                                onClick={handleCustomTip}
                            >
                                {customActive ? `${tipAmount} MKD` : t("cart.custom")}
                            </button>
                        </div>
                    </div>


                    <div className="total-row">
                        <span className="total-label">{t("cart.total")}</span>
                        <span className="total-amount">{fmtMKD(total)}</span>
                    </div>

                    <PaymentOptions />

                    <Suggestions
                        suggestions={suggestions}
                        qtyById={qtyById}
                        addToCart={addToCart}
                        removeFromCart={removeFromCart}
                    />
                </>
            )}

            {!isPreviousTab && cart.length === 0 && (
                <ViewOrderPill
                    variant="center"
                    text={t("cart.viewMenu")}
                    totalText=""
                    onClick={handleBackClick}
                    className="cart-bottom-pill"
                />
            )}

            {!isPreviousTab && cart.length > 0 && (
                <ViewOrderPill
                    variant="center"
                    text={isPlacing ? t("cart.placing") : t("cart.placeOrder")}
                    totalText={fmtMKD(total)}
                    onClick={() => setShowConfirm(true)}
                    disabled={isPlacing}
                    className="cart-bottom-pill"
                />
            )}
        </div>
    );
}

export default Cart;
