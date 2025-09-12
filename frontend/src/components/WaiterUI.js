
import { useState, useEffect } from "react";
import api from "../api";
import "./components-style/App.css";
import WaiterMenu from "./WaiterMenu";

function WaiterUI({
    cart,
    setCart,
    addToCart,
    removeFromCart,
    category,
    setCategory,
    view,
    setView,
}) {
    const [tables, setTables] = useState([]);
    const [selectedTable, setSelectedTable] = useState(null);

    useEffect(() => {
        api
            .get("/tables/all")
            .then((res) => setTables(res.data))
            .catch((err) => console.error("Failed to fetch tables", err));
    }, []);

    if (selectedTable) {
        return (
            <WaiterMenu
                tableId={selectedTable.id}
                tableToken={selectedTable.token}
                cart={cart}
                setCart={setCart}
                addToCart={addToCart}
                removeFromCart={removeFromCart}
                category={category}
                setCategory={setCategory}
                view={view}
                setView={setView}
                goBack={() => {
                    setSelectedTable(null);
                    setCart([]);
                    setCategory(null);
                    setView("menu");
                }}
            />
        );
    }

    return (
        <div className="waiter-ui">
            <h2>Select a Table</h2>
            <div className="table-grid">
                {tables.map((t) => (
                    <div
                        key={t.id}
                        className="table-card"
                        onClick={() => setSelectedTable(t)}  // pass full object (id, name, token)
                    >
                        {t.name}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default WaiterUI;
