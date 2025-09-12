// src/components/WaiterUI.js
import { useState, useEffect } from "react";
import Menu from "./Menu";
import Cart from "./Cart";
import api from "../api";
import "./components-style/App.css";

function WaiterUI({ cart, setCart, addToCart, removeFromCart, category, setCategory, view }) {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);

    useEffect(() => {
        api.get("/tables/all")
            .then(res => setTables(res.data))
            .catch(err => console.error("Failed to fetch tables", err));
    }, []);

    return (
        <div className="waiter-ui">
            <div className="waiter-panel">
                <h2>Select Table</h2>
                <select
                    value={selectedTable || ""}
                    onChange={(e) => {
                        setSelectedTable(parseInt(e.target.value));
                        setCart([]); // clear cart when switching tables
                        setCategory(null);
                    }}
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
                            tableId={selectedTable}   // waiter uses table ID
                            isWaiter={true}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default WaiterUI;
