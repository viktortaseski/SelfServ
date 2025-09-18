import { useState, useEffect } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Notification from "./components/Notification";
import WaiterUI from "./components/WaiterUI";
import api from "./api";
import "./components/components-style/App.css";
import "./components/components-style/Waiter.css"; // bring in profile/order styles

function App() {
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");
  const [category, setCategory] = useState(null);
  const [notice, setNotice] = useState(null); // 🔔 changed from string -> object
  const [tableToken, setTableToken] = useState(null);
  const [tableName, setTableName] = useState(null);
  const [isWaiter, setIsWaiter] = useState(false);

  // ---------- URL/hash <-> view sync (so browser back works) ----------
  const viewFromHash = () => {
    const raw = window.location.hash.replace(/^#/, "");
    const path = raw.startsWith("/") ? raw.slice(1) : raw;
    // we only care about '', 'cart'
    if (path.split("?")[0] === "cart") return "cart";
    return "menu";
  };

  useEffect(() => {
    // set initial view from hash
    setView(viewFromHash());

    const onHashChange = () => {
      setView(viewFromHash());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Helper to navigate and push to history
  const goto = (nextView) => {
    if (nextView === "cart") {
      window.location.hash = "/cart";
    } else {
      window.location.hash = "/";
    }
    // setView runs via hashchange listener, but also set immediately for snappy UI
    setView(nextView);
  };

  // ---------- Cart persistence (not permanent) ----------
  // Load from sessionStorage on first mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("cart");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch { }
  }, []);

  // Save to sessionStorage whenever cart changes
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

  // 🔔 tiny helper to fire a toast, always unique so it retriggers
  const toast = (text) => {
    setNotice({ id: Date.now() + Math.random(), text });
  };

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

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <h1 className="logo" onClick={() => goto("menu")}>
          SelfServ
        </h1>

        {/* Waiter/Admin: show My Profile; Customer: show My Cart */}
        {isWaiter ? (
          <a className="profile-link" href="#/waiter-login">
            My Profile
          </a>
        ) : (
          <div className="cart-icon" onClick={() => goto("cart")}>
            My Cart <span className="cart-count">{cart.length}</span>
          </div>
        )}
      </nav>

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

              {/* Show category grid only when no category filter is active */}
              {category === null && (
                <div className="category-grid">
                  {["coffee", "drinks", "food", "desserts"].map((cat) => (
                    <div
                      key={cat}
                      className="category-card"
                      onClick={() => setCategory(cat)}
                    >
                      {cat.toUpperCase()}
                    </div>
                  ))}
                </div>
              )}

              <Menu
                addToCart={addToCart}
                category={category}
                setCategory={setCategory} // needed for "Back to Menu"
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

      <Notification message={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

export default App;
