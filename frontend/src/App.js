import { useState, useEffect, useMemo, useRef } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Notification from "./components/Notification";
import WaiterUI from "./components/WaiterUI";
import api from "./api";
import "./components/components-style/App.css";
import "./components/components-style/Waiter.css";

/* ---- Category icons (PNG) ---- */
import coffeeIcon from "./assets/category-icons/espresso.png";
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

const CATS = ["coffee", "drinks", "food", "desserts"];
const FIRST_CAT = CATS[0];
const LAST_CAT = CATS[CATS.length - 1];

// Key used to persist active tab between reloads
const ACTIVE_CAT_KEY = "activeCategory";

function App() {
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");

  // Restore last active category from sessionStorage; fallback to coffee
  const [category, _setCategory] = useState(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_CAT_KEY);
      return CATS.includes(saved) ? saved : "coffee";
    } catch {
      return "coffee";
    }
  });

  const [searchText, setSearchText] = useState("");
  const [notice, setNotice] = useState(null);
  const [tableToken, setTableToken] = useState(null);
  const [tableName, setTableName] = useState(null);
  const [isWaiter, setIsWaiter] = useState(false);

  // Header collapse on scroll (hides search + category icons)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Hide the bottom pill when scrolling down
  const [pillHidden, setPillHidden] = useState(false);
  const lastY = useRef(0);
  const idleTimer = useRef(null);

  // Guards for scroll-driven changes
  const userLockUntil = useRef(0);

  // Helper: scroll positions
  const getScrollY = () =>
    window.scrollY ??
    document.documentElement.scrollTop ??
    document.body.scrollTop ??
    0;

  const getMaxScroll = () =>
    (document.documentElement.scrollHeight || 0) - window.innerHeight;

  // Helper: are we near the top/bottom rubber-band zones?
  const isAtTop = () => getScrollY() <= 2;
  const isAtBottom = () => Math.abs(getScrollY() - getMaxScroll()) <= 2;

  // Unified internal setter: keeps storage in sync
  const setCategory = (cat) => {
    if (!CATS.includes(cat)) return;
    _setCategory((prev) => {
      if (prev === cat) return prev;
      try {
        sessionStorage.setItem(ACTIVE_CAT_KEY, cat);
      } catch { }
      return cat;
    });
  };

  // Scroll bookkeeping (direction + header collapse + pill visibility)
  useEffect(() => {
    const onScroll = () => {
      const y = getScrollY();
      setIsCollapsed(y > 8);

      if (y > lastY.current + 4) setPillHidden(true);
      else if (y < lastY.current - 4) setPillHidden(false);
      lastY.current = y;

      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setPillHidden(false), 250);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
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
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: newQty } : i
        );
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
      return prev.map((i) =>
        i.id === item.id ? { ...i, quantity: newQty } : i
      );
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

  // Category chip click — always show the menu when a category is chosen
  const selectCategory = (cat) => {
    setCategory(cat);
    // lock out scroll-sourced changes for a short period after a tap
    userLockUntil.current = performance.now() + 700;
    if (view !== "menu") goto("menu");
  };

  // ONLY FOR SCROLL-DRIVEN updates coming from <Menu />
  const setCategoryFromScroll = (cat) => {
    // respect user lock (they just tapped a tab)
    if (performance.now() < userLockUntil.current) return;

    // ignore noisy flips at top/bottom edges
    if ((isAtTop() && cat === FIRST_CAT && category !== FIRST_CAT) ||
      (isAtBottom() && cat === LAST_CAT && category !== LAST_CAT)) {
      return;
    }

    if (category === cat) return;
    setCategory(cat);
  };

  // Scroll to top whenever we enter the cart view
  useEffect(() => {
    if (view === "cart") {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      try {
        window.scrollTo({ top: 0, behavior: "auto" });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [view]);

  return (
    <div className="app-container">
      {/* ===== One fixed header: navbar + search + categories ===== */}
      <nav className={`navbar ${isCollapsed ? "is-collapsed" : ""}`}>
        <div className="nav-top">
          <div className="brand-wrap" onClick={onLogoClick}>
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
            {/* Centered search (icon + text group) */}
            <div className="search-wrap">
              <input
                className="search-input"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="Search menu"
              />
              <div className={`search-center ${searchText ? "is-hidden" : ""}`}>
                <img src={searchIcon} alt="" className="search-center-icon" />
                <span className="search-center-text">Search</span>
              </div>

              {/* Clear (✕) button when there is text */}
              {searchText && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search"
                  onClick={() => setSearchText("")}
                >
                  ×
                </button>
              )}
            </div>

            <div className="category-row category-row--tabs">
              {/* CSS-only indicator now lives under the active chip’s label */}
              {CATS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  data-cat={cat}
                  className={`category-chip ${category === cat ? "is-active" : ""}`}
                  onClick={() => selectCategory(cat)}
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
            <Menu
              addToCart={addToCart}
              removeFromCart={removeFromCart}
              cart={cart}
              category={category}
              // IMPORTANT: pass the guarded setter to Menu (used for scroll-driven changes)
              setCategory={setCategoryFromScroll}
              search={searchText}
            />
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

      {/* Sticky bottom pill: only when there is at least 1 item */}
      {!isWaiter && view === "menu" && cartCount > 0 && (
        <button
          className={`view-order-pill ${pillHidden ? "pill-hidden" : ""}`}
          onClick={() => goto("cart")}
        >
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

  // LOGO click: stay in menu, select Coffee, scroll to top
  function onLogoClick() {
    setCategory("coffee");
    goto("menu");
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      window.scrollTo(0, 0);
    }
  }
}

export default App;
