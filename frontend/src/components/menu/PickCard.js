import { fmtMKD, PLACEHOLDER } from "../common/format";

export default function PickCard({ item, onAdd }) {
    if (!item) return null;

    const isLongName = (item.name || "").length > 18;

    const handleAdd = () => onAdd?.(item);
    const handleImgError = (e) => {
        e.currentTarget.src = PLACEHOLDER;
    };

    return (
        <div className="pick-card" tabIndex={0}>
            <img
                className={`pick-image ${isLongName ? "pick-image--tight" : ""}`}
                src={item.image_url || PLACEHOLDER}
                alt={item.name}
                loading="lazy"
                onClick={handleAdd}
                onError={handleImgError}
            />
            <div
                className={`pick-meta ${isLongName ? "pick-meta--tight" : ""}`}
                onClick={handleAdd}
            >
                <div className="pick-name">{item.name}</div>
                <div className="pick-price">{fmtMKD(item.price || 0)}</div>
            </div>
            <button
                className="pick-add"
                aria-label={`Add ${item.name} to order`}
                onClick={handleAdd}
            >
                +
            </button>
        </div>
    );
}
