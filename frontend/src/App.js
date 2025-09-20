import { useState, useEffect, useMemo } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Notification from "./components/Notification";
import WaiterUI from "./components/WaiterUI";
import api from "./api";
import "./components/components-style/App.css";
import "./components/components-style/Waiter.css";

/* ---- Category icons (PNG) ---- */
import coffeeIcon from "./assets/category-icons/coffee.png";
import drinksIcon from "./assets/category-icons/drinks.png";
import foodIcon from "./assets/category-icons/food.png";
import dessertsIcon from "./assets/category-icons/desserts.png";
/* ---- Search icon ---- */
import searchIcon from "./assets/category-icons/search.png";

const ICONS = {
  coffee: coffeeIcon,
  drinks: drinksIcon,
  food: foodIcon,
  desserts: dessertsIcon,
};

function App() {
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");
  const [category, setCategory] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [notice, setNotice] = useState(null);
  const [tableToken, setTableToken] = useState(null);
  const [tableName, setTableName] = useState(null);
  const [isWaiter, setIsWaiter] = useState(false);

  // NEW: header collapse on scroll
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsCollapsed(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  // ---------- Cart persistence ----------
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

  // Sum of quantities for the black count dot
  const cartCount = useMemo(
    () => cart.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    [cart]
  );

  // MKD total
  const totalMKD = useMemo(
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
      {/* ===== One fixed header: navbar + search + categories ===== */}
      <nav className={`navbar ${isCollapsed ? "is-collapsed" : ""}`}>
        <div className="nav-top">
          <div className="brand-wrap" onClick={() => goto("menu")}>
            <div className="brand-logo">LOGO</div>
          </div>

          {isWaiter ? (
            <a className="profile-link" href="#/waiter-login">My Profile</a>
          ) : (
            <div className="powered-by">
              <span className="powered-by-small">supported by</span>
              <span className="powered-by-brand">selfserv</span>
            </div>
          )}
        </div>

        {!isWaiter && (
          <>
            <div className="search-wrap">
              <input
                className="search-input"
                type="text"
                placeholder="Search"
                style={{ backgroundImage: `url(${searchIcon})` }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="category-row category-row--tabs">
              {["coffee", "drinks", "food", "desserts"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  data-cat={cat}
                  className={`category-chip ${category === cat ? "is-active" : ""}`}
                  onClick={() => toggleCategory(cat)}
                >
                  <img
                    src={ICONS[cat]}
                    alt=""
                    className="chip-icon-img"
                    draggable="false"
                  />
                  <span className="chip-label" style={{ textTransform: "capitalize" }}>
                    {cat}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

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
                  {tableName.replace("table", "Table ")}
                </h2>
              )}

              <Menu
                addToCart={addToCart}
                category={category}
                setCategory={setCategory}
                search={searchText}
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

      {/* Sticky bottom pill */}
      {!isWaiter && view === "menu" && (
        <button className="view-order-pill" onClick={() => goto("cart")}>
          <span className="pill-left">
            <span className="pill-count">{cartCount}</span>
            <span className="pill-text">View Order</span>
          </span>
          <span className="pill-total">{Math.round(totalMKD)} MKD</span>
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
