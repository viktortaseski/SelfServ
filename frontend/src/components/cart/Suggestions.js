import MenuItem from "../menu/MenuItem";
import { t } from "../../i18n";

function Suggestions({ suggestions, qtyById, addToCart, removeFromCart }) {
    if (!suggestions.length) return null;
    return (
        <div className="block" style={{ marginTop: "30px" }}>
            <div className="block-title" style={{ textAlign: "center" }}>{t("cart.youMayLike")}</div>
            <ul className="menu-list menu-list--full">
                {suggestions.map((item) => {
                    const qty = qtyById.get(item.id) || 0;
                    return (
                        <MenuItem
                            key={`s-${item.id}`}
                            item={item}
                            qty={qty}
                            onAdd={addToCart}
                            onRemove={removeFromCart}
                        // no cart variant here
                        />
                    );
                })}
            </ul>
        </div>
    );
}

export default Suggestions;