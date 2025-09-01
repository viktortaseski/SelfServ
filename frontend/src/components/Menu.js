import { useEffect, useState } from "react";
import api from "../api";

function Menu({ addToCart }) {
    const [items, setItems] = useState([]);

    useEffect(() => {
        api.get("/menu").then(res => setItems(res.data));
    }, []);

    return (
        <div>
            <h2>Menu</h2>
            <ul>
                {items.map(item => (
                    <li key={item.id}>
                        {item.name} - €{item.price.toFixed(2)}
                        <button onClick={() => addToCart(item)}>+</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default Menu;
