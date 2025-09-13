// src/App.js
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
  const [notification, setNotification] = useState("");
  const [tableToken, setTableToken] = useState(null);
  const [tableName, setTableName] = useState(null);
  const [isWaiter, setIsWaiter] = useState(false);

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

  const showNotification = (msg) => setNotification(msg);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        showNotification(`1 ${item.name} added`);
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      showNotification(`1 ${item.name} added`);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        showNotification(`1 ${item.name} removed`);
        return prev.filter((i) => i.id !== item.id);
      }
      showNotification(`1 ${item.name} removed`);
      return prev.map((i) =>
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

        {/* Waiter/Admin: show My Profile; Customer: show My Cart */}
        {isWaiter ? (
          <a className="profile-link" href="#/waiter-login">
            My Profile
          </a>
        ) : (
          <div className="cart-icon" onClick={() => setView("cart")}>
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
              onBackToMenu={() => setView("menu")}
            />
          )}
        </>
      )}

      <Notification message={notification} onClose={() => setNotification("")} />
    </div>
  );
}

export default App;
