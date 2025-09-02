import { useState } from "react";
import Menu from "./components/Menu";
import Cart from "./components/Cart";
import api from "./api";

function App() {
  const [cart, setCart] = useState([]);

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const checkout = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tableToken = urlParams.get("token");

    api.post("/orders", { tableToken, items: cart })
      .then(res => {
        alert("Order placed! ID: " + res.data.orderId);
        setCart([]);
      })
      .catch(err => alert("Error: " + err.response.data.error));
  };

  return (
    <div>
      <h1>SelfServ Ordering</h1>
      <p>Hello World</p>
      <Menu addToCart={addToCart} />
      <Cart cart={cart} checkout={checkout} />
    </div>
  );
}

export default App;
