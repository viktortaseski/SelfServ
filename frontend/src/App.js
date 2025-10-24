import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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

const parseRestaurantIdFromRaw = (raw) => {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const num = Number(str);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

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

  useEffect(() => {
    if (!restaurantId) {
      setRestaurantActive(true);
      return;
    }
    let cancelled = false;
    api
      .get("/restaurants/status", { params: { restaurantId } })
      .then((res) => {
        if (cancelled) return;
        const isActive = res?.data?.restaurant?.is_active;
        setRestaurantActive(isActive !== false);
      })
      .catch(() => {
        if (!cancelled) setRestaurantActive(true);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

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
  const [restaurantGeo, setRestaurantGeo] = useState(null);
  const [restaurantId, setRestaurantId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw =
        params.get("restaurant_id") ?? params.get("restaurantId");
      return parseRestaurantIdFromRaw(raw);
    } catch {
      return null;
    }
  });
  const [restaurantActive, setRestaurantActive] = useState(true);
  const prevRestaurantId = useRef(null);

  const parseRestaurantGeo = (source) => {
    if (!source) return null;

    if (typeof source.lat === "number" && typeof source.lng === "number") {
      const radius = Number(source.radius);
      return {
        lat: source.lat,
        lng: source.lng,
        radius: Number.isFinite(radius) ? radius : null,
        restaurantId: source.restaurantId ?? null,
        name: source.name ?? null,
      };
    }

    const locRaw = source.restaurant_location || source.location || null;
    if (typeof locRaw !== "string") return null;
    const parts = locRaw.split(",").map((part) => part.trim());
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const radiusRaw = source.restaurant_radius ?? source.radius;
    const radius = Number(radiusRaw);
    return {
      lat,
      lng,
      radius: Number.isFinite(radius) ? radius : null,
      restaurantId: source.restaurant_id ?? source.restaurantId ?? null,
      name: source.restaurant_name || source.name || null,
    };
  };

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
    if (!restaurantId) return;
    const prev = prevRestaurantId.current;
    if (prev && prev !== restaurantId) {
      setCart([]);
    }
    prevRestaurantId.current = restaurantId;
  }, [restaurantId]);

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

  const handleMenuLoaded = useCallback((items) => {
    if (!Array.isArray(items)) return;
    const validIds = new Set(
      items
        .map((it) => Number(it.id))
        .filter((id) => Number.isFinite(id))
    );
    setCart((prev) => prev.filter((item) => validIds.has(Number(item.id))));
  }, []);

  // Token exchange on load (customer)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qrToken = urlParams.get("token");
    const rawRestaurantParam =
      urlParams.get("restaurant_id") ?? urlParams.get("restaurantId");
    const urlRestaurantId = parseRestaurantIdFromRaw(rawRestaurantParam);
    if (urlRestaurantId && urlRestaurantId !== restaurantId) {
      setRestaurantId(urlRestaurantId);
    }

    const resolvedStateRestaurantId = parseRestaurantIdFromRaw(restaurantId);

    async function exchange(qrTok, requestedRestaurantId) {
      const payload = { tableToken: qrTok };
      const desiredRestaurantId =
        parseRestaurantIdFromRaw(requestedRestaurantId) ??
        urlRestaurantId ??
        resolvedStateRestaurantId ??
        null;
      if (desiredRestaurantId) {
        payload.restaurantId = desiredRestaurantId;
      }

      try {
        const res = await api.post("/tokens/exchange", payload);
        const { accessToken, expiresAt, table } = res.data || {};
        const geo = parseRestaurantGeo(table);
        const tableRestaurantId = parseRestaurantIdFromRaw(
          table?.restaurant_id ?? table?.restaurantId
        );
        const rawActive =
          table?.restaurant_is_active ?? table?.restaurantIsActive ?? null;
        const normalizedActive =
          rawActive == null ? null : Boolean(rawActive);

        setAccessToken(accessToken);
        setTableName(table?.name || null);
        setRestaurantGeo(geo);
        setRestaurantId(
          tableRestaurantId ?? urlRestaurantId ?? resolvedStateRestaurantId ?? null
        );
        if (normalizedActive != null) {
          setRestaurantActive(normalizedActive);
        }

        localStorage.setItem(
          "accessToken",
          JSON.stringify({
            token: accessToken,
            exp: expiresAt,
            tableName: table?.name,
            restaurantGeo: geo,
            restaurantId: tableRestaurantId ?? null,
            restaurantActive:
              normalizedActive != null ? normalizedActive : undefined,
          })
        );
      } catch (e) {
        console.warn("Token exchange failed:", e?.response?.data || e.message);
        setAccessToken(null);
        setTableName(null);
        setRestaurantGeo(null);
        setRestaurantId(urlRestaurantId ?? resolvedStateRestaurantId ?? null);
        setRestaurantActive(true);
      }
    }

    if (qrToken) {
      exchange(qrToken, urlRestaurantId);
    } else {
      try {
        const raw = localStorage.getItem("accessToken");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && parsed?.exp && new Date(parsed.exp) > new Date()) {
            setAccessToken(parsed.token);
            setTableName(parsed.tableName || null);
            if (parsed.restaurantGeo) {
              const storedGeo = parseRestaurantGeo(parsed.restaurantGeo);
              if (storedGeo) setRestaurantGeo(storedGeo);
            }
            const storedRestaurantId = parseRestaurantIdFromRaw(
              parsed.restaurantId
            );
            if (storedRestaurantId) {
              setRestaurantId(storedRestaurantId);
            } else if (urlRestaurantId) {
              setRestaurantId(urlRestaurantId);
            } else {
              setRestaurantId(null);
            }
            if (parsed.restaurantActive != null) {
              setRestaurantActive(Boolean(parsed.restaurantActive));
            }
          } else {
            localStorage.removeItem("accessToken");
            setAccessToken(null);
            setTableName(null);
            setRestaurantGeo(null);
            setRestaurantId(urlRestaurantId ?? null);
            setRestaurantActive(true);
          }
        } else if (urlRestaurantId) {
          setRestaurantId(urlRestaurantId);
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

            {restaurantActive && (
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
            )}
          </>
        )}
      </nav>

      <>
        {view === "menu" && (restaurantActive ? (
          <Menu
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            cart={cart}
            category={category}
            setCategory={setCategoryFromScroll}
            search={searchText}
            onMenuLoaded={handleMenuLoaded}
            restaurantId={restaurantId}
          />
        ) : (
          <div
            className="menu-container"
            style={{
              padding: "80px 24px",
              textAlign: "center",
              color: "#444",
            }}
          >
            <h2 style={{ marginBottom: 12 }}>Currently unavailable</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              This restaurant is not accepting orders right now. Please check back during working hours.
            </p>
          </div>
        ))}

        {view === "cart" && (
          <Cart
            cart={cart}
            addToCart={addToCart}
            removeFromCart={removeFromCart}
            tableToken={accessToken}
            tableName={tableName}
            restaurantGeo={restaurantGeo}
            restaurantId={restaurantId}
            restaurantActive={restaurantActive}
            setCartItems={setCart}
            clearCart={() => setCart([])}
            notify={toast}
            activeTab={cartTab}
            onTabChange={handleCartTabChange}
            onRequestClose={closeCartWithAnimation}
            isClosing={isCartClosing}
          />
        )}

      </>

      {view === "menu" && restaurantActive && cartCount > 0 && (
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
