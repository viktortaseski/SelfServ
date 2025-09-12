// src/components/WaiterUI.js
import { useState, useEffect } from "react";
import api from "../api";
import "./components-style/App.css";
import WaiterMenu from "./WaiterMenu";

function WaiterUI({ cart, setCart, addToCart, removeFromCart, category, setCategory, view }) {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);

    useEffect(() => {
        api
            .get("/tables/all")
            .then((res) => setTables(res.data))
            .catch((err) => console.error("Failed to fetch tables", err));
    }, []);

    // If a table has been chosen, show WaiterMenu instead of the table grid
    if (selectedTable) {
        return (
            <WaiterMenu
                tableId={selectedTable}
                cart={cart}
                setCart={setCart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                category={category}
                setCategory={setCategory}
                view={view}
                goBack={() => {
                    // reset selection if waiter wants to choose another table
                    setSelectedTable(null);
                    setCart([]);
                    setCategory(null);
                }}
            />
        );
    }

    // Otherwise show table grid
    return (
        <div className="waiter-ui">
            <h2>Select a Table</h2>
            <div className="table-grid">
                {tables.map((t) => (
                    <div
                        key={t.id}
                        className="table-card"
                        onClick={() => setSelectedTable(t.id)}
                    >
                        {t.name}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default WaiterUI;
