import { useState, useEffect, useMemo, useRef } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Notification from "./components/Notification";
import api from "./api";
import "./components/components-style/App.css";
import ViewOrderPill from "./components/common/ViewOrderPill";

import coffeeIcon from "./assets/category-icons/espresso.png";
import drinksIcon from "./assets/category-icons/drinks.png";
import foodIcon from "./assets/category-icons/food.png";
import dessertsIcon from "./assets/category-icons/desserts.png";
import searchIcon from "./assets/category-icons/search.png";
import backIcon from "./assets/other-images/back-button.svg";

import { t, labelForCat, detectLang, setLang } from "./i18n";

const ICONS = { coffee: coffeeIcon, drinks: drinksIcon, food: foodIcon, desserts: dessertsIcon };
const CATS = ["coffee", "drinks", "food", "desserts"];
const FIRST_CAT = CATS[0];
const LAST_CAT = CATS[CATS.length - 1];
const ACTIVE_CAT_KEY = "activeCategory";

function App() {

  const [lang, _setLang] = useState(detectLang);

  useEffect(() => {
    console.log("[i18n] current lang:", lang);
  }, [lang]);

  useEffect(() => {
    try {
      const hasStored = !!localStorage.getItem("lang");
      const urlLang = new URLSearchParams(window.location.search).get("lang");
      if (!hasStored && !urlLang) {
        const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
        const lc = String(nav).toLowerCase();
        const pick = lc.startsWith("mk") ? "mk" : "en";
        setLang(pick);
        _setLang(pick);
      }
    } catch { }
  }, []);

  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");
  const [cartTab, setCartTab] = useState("current");

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
  const [isCartClosing, setIsCartClosing] = useState(false);

  const [accessToken, setAccessToken] = useState(null); // short-lived token
  const [tableName, setTableName] = useState(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pillHidden, setPillHidden] = useState(false);
  const lastY = useRef(0);
  const idleTimer = useRef(null);
  const userLockUntil = useRef(0);
  const cartCloseTimer = useRef(null);

  const getScrollY = () =>
    window.scrollY ??
    document.documentElement.scrollTop ??
    document.body.scrollTop ??
    0;

  const getMaxScroll = () =>
    (document.documentElement.scrollHeight || 0) - window.innerHeight;

  const isAtTop = () => getScrollY() <= 2;
  const isAtBottom = () => Math.abs(getScrollY() - getMaxScroll()) <= 2;

  const setCategory = (cat) => {
    if (!CATS.includes(cat)) return;
    _setCategory((prev) => {
      if (prev === cat) return prev;
      try { sessionStorage.setItem(ACTIVE_CAT_KEY, cat); } catch { }
      return cat;
    });
  };

  useEffect(() => {
    const onScroll = () => {
      // 👇 Freeze navbar state in cart/order view
      if (view === "cart") {
        setIsCollapsed(false);
        return;
      }

      const y = getScrollY();
      setIsCollapsed(y > 30);

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
  }, [view]);


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

  useEffect(() => {
    if (view !== "cart") {
      setIsCartClosing(false);
    }
  }, [view]);

  useEffect(() => () => {
    if (cartCloseTimer.current) {
      clearTimeout(cartCloseTimer.current);
      cartCloseTimer.current = null;
    }
  }, []);

  const goto = (nextView) => {
    if (nextView === view) return;
    if (cartCloseTimer.current) {
      clearTimeout(cartCloseTimer.current);
      cartCloseTimer.current = null;
    }
    if (nextView === "cart") {
      setIsCartClosing(false);
    }
    if (nextView !== "cart") {
      setIsCartClosing(false);
    }
    window.location.hash = nextView === "cart" ? "/cart" : "/";
    setView(nextView);
  };

  // Cart persistence
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
    try { sessionStorage.setItem("cart", JSON.stringify(cart)); } catch { }
  }, [cart]);

  // Token exchange on load (customer)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qrToken = urlParams.get("token");

    async function exchange(qrTok) {
      try {
        const res = await api.post("/tokens/exchange", { tableToken: qrTok });
        const { accessToken, expiresAt, table } = res.data || {};
        setAccessToken(accessToken);
        setTableName(table?.name || null);

        localStorage.setItem(
          "accessToken",
          JSON.stringify({ token: accessToken, exp: expiresAt, tableName: table?.name })
        );
      } catch (e) {
        console.warn("Token exchange failed:", e?.response?.data || e.message);
        setAccessToken(null);
        setTableName(null);
      }
    }

    if (qrToken) {
      exchange(qrToken);
    } else {
      try {
        const raw = localStorage.getItem("accessToken");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && parsed?.exp && new Date(parsed.exp) > new Date()) {
            setAccessToken(parsed.token);
            setTableName(parsed.tableName || null);
          } else {
            localStorage.removeItem("accessToken");
          }
        }
      } catch { }
    }
  }, []);

  const toast = (text, duration) =>
    setNotice({ id: Date.now() + Math.random(), text, duration });

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

  const cartCount = useMemo(
    () => cart.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    [cart]
  );

  const totalMKD = useMemo(
    () => cart.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0),
    [cart]
  );

  const selectCategory = (cat) => {
    setCategory(cat);
    userLockUntil.current = performance.now() + 700;
    if (view !== "menu") goto("menu");
  };

  const setCategoryFromScroll = (cat) => {
    if (performance.now() < userLockUntil.current) return;
    if ((isAtTop() && cat === FIRST_CAT && category !== FIRST_CAT) ||
      (isAtBottom() && cat === LAST_CAT && category !== LAST_CAT)) return;
    if (category === cat) return;
    setCategory(cat);
  };

  useEffect(() => {
    if (view === "cart") {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { window.scrollTo(0, 0); }
    }
  }, [view]);

  useEffect(() => {
    if (view !== "cart" && cartTab !== "current") {
      setCartTab("current");
    }
  }, [view, cartTab]);

  const handleCartTabChange = (tab) => {
    setCartTab(tab);
    if (view !== "cart") goto("cart");
  };

  const closeCartWithAnimation = () => {
    if (view !== "cart" || isCartClosing) return;
    setIsCartClosing(true);
    if (cartCloseTimer.current) clearTimeout(cartCloseTimer.current);
    cartCloseTimer.current = setTimeout(() => {
      cartCloseTimer.current = null;
      setIsCartClosing(false);
      goto("menu");
    }, 320);
  };

  return (
    <div className="app-container">
      <nav className={`navbar ${isCollapsed ? "is-collapsed" : ""} ${view === "cart" ? "is-cart-view" : ""}`}>
        {view === "cart" ? (
          <>
            <div className="cart-nav-header">
              <button
                type="button"
                className="cart-nav-back"
                onClick={closeCartWithAnimation}
                aria-label={t("orders.back")}
                disabled={isCartClosing}
              >
                <img src={backIcon} alt="" className="cart-nav-back-icon" draggable="false" />
              </button>
              <h2 className="cart-nav-title">{t("cart.myOrder")}</h2>
            </div>
            <div className="cart-nav-tabs">
              <button
                type="button"
                className={`cart-nav-tab ${cartTab === "current" ? "is-active" : ""}`}
                onClick={() => handleCartTabChange("current")}
                disabled={isCartClosing}
              >
                {t("cart.currentOrder")}
              </button>
              <button
                type="button"
                className={`cart-nav-tab ${cartTab === "previous" ? "is-active" : ""}`}
                onClick={() => handleCartTabChange("previous")}
                disabled={isCartClosing}
              >
                {t("cart.previousOrders")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="nav-top">
              <div className="brand-wrap" onClick={onLogoClick}>
                <div className="brand-logo">LOGO</div>
              </div>
              <div className="powered-by">
                <span className="powered-by-small">supported by</span>
                <span className="powered-by-brand">selfserv</span>
              </div>
            </div>

            <div className="search-wrap">
              <input
                className="search-input"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label={t("search")}
              />
              <div className={`search-center ${searchText ? "is-hidden" : ""}`}>
                <img src={searchIcon} alt="" className="search-center-icon" />
                <span className="search-center-text">{t("search")}</span>
              </div>
              {searchText && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label={t("search")}
                  onClick={() => setSearchText("")}
                >
                  ×
                </button>
              )}
            </div>

            <div className="category-row category-row--tabs">
              {CATS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  data-cat={cat}
                  className={`category-chip ${category === cat ? "is-active" : ""}`}
                  onClick={() => selectCategory(cat)}
                >
                  <img src={ICONS[cat]} alt="" className="chip-icon-img" draggable="false" />
                  <span className="chip-label" style={{ textTransform: "capitalize" }}>
                    {labelForCat(cat)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      <>
        {view === "menu" && (
          <Menu
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            cart={cart}
            category={category}
            setCategory={setCategoryFromScroll}
            search={searchText}
          />
        )}

        {view === "cart" && (
          <Cart
            cart={cart}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            tableToken={accessToken}
            tableName={tableName}
            clearCart={() => setCart([])}
            notify={toast}
            activeTab={cartTab}
            onTabChange={handleCartTabChange}
            onRequestClose={closeCartWithAnimation}
            isClosing={isCartClosing}
          />
        )}
      </>

      {view === "menu" && cartCount > 0 && (
        <ViewOrderPill
          count={cartCount}
          text={t("viewOrder")}
          totalText={`${Math.round(totalMKD)} MKD`}
          onClick={() => goto("cart")}
          hidden={pillHidden}
        />
      )}

      <Notification
        key={notice?.id}
        message={notice?.text || ""}
        id={notice?.id || 0}
        duration={notice?.duration ?? 4000}
        onClose={() => setNotice(null)}
      />
    </div>
  );

  function onLogoClick() {
    setCategory("coffee");
    goto("menu");
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0, 0); }
  }
}

export default App;
