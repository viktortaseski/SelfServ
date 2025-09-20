import { useState, useEffect, useMemo } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Notification from "./components/Notification";
import WaiterUI from "./components/WaiterUI";
import api from "./api";
import "./components/components-style/App.css";
import "./components/components-style/Waiter.css";

function App() {
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");
  const [category, setCategory] = useState(null);
  const [searchText, setSearchText] = useState(""); // 🔎 header search
  const [notice, setNotice] = useState(null);       // { id, text }
  const [tableToken, setTableToken] = useState(null);
  const [tableName, setTableName] = useState(null);
  const [isWaiter, setIsWaiter] = useState(false);

  // ---------- URL/hash <-> view sync ----------
  const viewFromHash = () => {
    const raw = window.location.hash.replace(/^#/, "");
    const path = raw.startsWith("/") ? raw.slice(1) : raw;
    return path.split("?")[0] === "cart" ? "cart" : "menu";
  };

  useEffect(() => {
    setView(viewFromHash());
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goto = (nextView) => {
    window.location.hash = nextView === "cart" ? "/cart" : "/";
    setView(nextView);
  };

  // ---------- Cart persistence (sessionStorage) ----------
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("cart");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch { }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("cart", JSON.stringify(cart));
    } catch { }
  }, [cart]);

  // ---------- Token / waiter detection ----------
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role === "waiter" || role === "admin") {
      setIsWaiter(true);
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get("token");
      const storedToken = localStorage.getItem("tableToken");
      const activeToken = tokenFromUrl || storedToken;
      if (activeToken) {
        setTableToken(activeToken);
        localStorage.setItem("tableToken", activeToken);
        api
          .get(`/tables`, { params: { token: activeToken } })
          .then((res) => setTableName(res.data.name))
          .catch(() => {
            setTableName("Unknown Table");
            localStorage.removeItem("tableToken");
          });
      }
    }
  }, []);

  // ---------- Notifications ----------
  const toast = (text) => setNotice({ id: Date.now() + Math.random(), text });

  // ---------- Cart ops ----------
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        const newQty = (existing.quantity || 0) + 1;
        toast(`${item.name} added. ${newQty} in order.`);
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i));
      }
      toast(`${item.name} added. 1 in order.`);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        toast(`${item.name} removed from order.`);
        return prev.filter((i) => i.id !== item.id);
      }
      const newQty = existing.quantity - 1;
      toast(`${item.name} removed. ${newQty} left.`);
      return prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i));
    });
  };

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
        0
      ),
    [cart]
  );

  // Category chip click (toggle off when clicking the same one)
  const toggleCategory = (cat) => setCategory((cur) => (cur === cat ? null : cat));

  return (
    <div className="app-container">
      {/* ===== Top: logo row only ===== */}
      <nav className="navbar">
        <div className="brand-wrap" onClick={() => goto("menu")}>
          <div className="brand-logo">LOGO</div>
        </div>
        {isWaiter ? (
          <a className="profile-link" href="#/waiter-login">My Profile</a>
        ) : (
          <div className="powered-by">powered by <span>selfserv</span></div>
        )}
      </nav>

      {/* ===== Decorative header area that also contains Search + Category chips ===== */}
      {!isWaiter && (
        <>
          <div className="header-bg" />
          <div className="search-wrap">
            <input
              className="search-input"
              type="text"
              placeholder="  🔍  Search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="category-row">
            {["coffee", "drinks", "food", "desserts"].map((cat) => (
              <button
                key={cat}
                type="button"
                data-cat={cat}
                className={`category-chip ${category === cat ? "is-active" : ""}`}
                onClick={() => toggleCategory(cat)}
              >
                <span className="chip-label" style={{ textTransform: "capitalize" }}>
                  {cat}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ===== CONTENT ===== */}
      {isWaiter ? (
        <WaiterUI
          cart={cart}
          setCart={setCart}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          category={category}
          setCategory={setCategory}
          view={view}
          setView={setView}
        />
      ) : (
        <>
          {view === "menu" && (
            <>
              {tableName && (
                <h2 className="table-banner">
                  You are at {tableName.replace("table", "Table ")}
                </h2>
              )}

              <Menu
                addToCart={addToCart}
                category={category}
                setCategory={setCategory}
                search={searchText}   // 🔎 external search drives Menu filtering
              />
            </>
          )}

          {view === "cart" && (
            <Cart
              cart={cart}
              addToCart={addToCart}
              removeFromCart={removeFromCart}
              tableToken={tableToken}
              isWaiter={false}
              clearCart={() => setCart([])}
              onBackToMenu={() => goto("menu")}
            />
          )}
        </>
      )}

      {/* Sticky bottom pill (replaces top-right “My Order”) */}
      {!isWaiter && view === "menu" && (
        <button className="view-order-pill" onClick={() => goto("cart")}>
          <span style={{ display: "flex", alignItems: "center" }}>
            <span className="pill-count">{cart.length}</span>
            <span className="pill-text">View Order</span>
          </span>
          <span className="pill-total">€{total.toFixed(2)}</span>
        </button>
      )}

      {/* Toast */}
      <Notification
        message={notice?.text || ""}
        id={notice?.id || 0}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

export default App;
