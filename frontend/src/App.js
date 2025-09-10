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

  // Grab token and fetch table info
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");
    const storedToken = localStorage.getItem("tableToken");

    const activeToken = tokenFromUrl || storedToken;
    if (activeToken) {
      setTableToken(activeToken);
      localStorage.setItem("tableToken", activeToken);

      // fetch table name
      api.get(`/tables`, { params: { token: activeToken } })
        .then(res => setTableName(res.data.name))
        .catch(() => {
          setTableName("Unknown Table");
          // optional: clear stale token so a new scan works
          localStorage.removeItem("tableToken");
        });

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

  const checkout = () => {
    api.post("/orders", { tableToken, items: cart })
      .then(res => {
        showNotification("Order placed! ID: " + res.data.orderId);
        setCart([]);
        setView("menu");
      })
      .catch(err => showNotification("Error: " + err.response.data.error));
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
          checkout={checkout}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          tableName={tableName}
        />
      )}

      <Notification message={notification} onClose={() => setNotification("")} />
    </div>
  );
}

export default App;
