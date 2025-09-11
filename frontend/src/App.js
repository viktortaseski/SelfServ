import { useState, useEffect } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import Notification from "./components/Notification";
import api from "./api";
import "./components/components-style/App.css";

function App() {
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("menu");
  const [category, setCategory] = useState(null);
  const [notification, setNotification] = useState("");
  const [tableToken, setTableToken] = useState(null);
  const [tableName, setTableName] = useState(null);

  // ⭐ New: waiter mode
  const [isWaiter, setIsWaiter] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role === "waiter" || role === "admin") {
      setIsWaiter(true);
      // fetch all tables
      api.get("/tables/all").then(res => setTables(res.data));
    } else {
      // customer flow
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get("token");
      const storedToken = localStorage.getItem("tableToken");

      const activeToken = tokenFromUrl || storedToken;
      if (activeToken) {
        setTableToken(activeToken);
        localStorage.setItem("tableToken", activeToken);

        api.get(`/tables`, { params: { token: activeToken } })
          .then(res => setTableName(res.data.name))
          .catch(() => {
            setTableName("Unknown Table");
            localStorage.removeItem("tableToken");
          });
      }
    }
  }, []);

  const showNotification = (msg) => setNotification(msg);

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        showNotification(`1 ${item.name} added`);
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      showNotification(`1 ${item.name} added`);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        showNotification(`1 ${item.name} removed`);
        return prev.filter(i => i.id !== item.id);
      }
      showNotification(`1 ${item.name} removed`);
      return prev.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  };

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <h1 className="logo" onClick={() => setView("menu")}>
          SelfServ
        </h1>
        <div className="cart-icon" onClick={() => setView("cart")}>
          🛒 <span className="cart-count">{cart.length}</span>
        </div>
      </nav>

      {isWaiter ? (
        <>
          <div className="waiter-panel">
            <h2>Select Table</h2>
            <select
              value={selectedTable || ""}
              onChange={(e) => setSelectedTable(e.target.value)}
            >
              <option value="">-- choose table --</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {selectedTable && (
            <>
              <Menu addToCart={addToCart} category={category} />
              {view === "cart" && (
                <Cart
                  cart={cart}
                  addToCart={addToCart}
                  removeFromCart={removeFromCart}
                  tableId={selectedTable}   // ⭐ waiter uses ID
                  isWaiter={true}
                />
              )}
            </>
          )}
        </>
      ) : (
        <>
          {view === "menu" && (
            <>
              {tableName && (
                <h2 className="table-banner">
                  You are at {tableName.replace("table", "Table ")}
                </h2>
              )}
              <div className="category-grid">
                {["coffee", "drinks", "food", "desserts"].map(cat => (
                  <div
                    key={cat}
                    className="category-card"
                    onClick={() => setCategory(cat)}
                  >
                    {cat.toUpperCase()}
                  </div>
                ))}
              </div>
              <Menu addToCart={addToCart} category={category} />
            </>
          )}
          {view === "cart" && (
            <Cart
              cart={cart}
              addToCart={addToCart}
              removeFromCart={removeFromCart}
              tableToken={tableToken}   // ⭐ customer uses token
              isWaiter={false}
            />
          )}
        </>
      )}

      <Notification message={notification} onClose={() => setNotification("")} />
    </div>
  );
}

export default App;
