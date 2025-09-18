import { useEffect } from "react";
import "./components-style/Notification.css";

/**
 * Accepts either:
 * - string (legacy)
 * - { id: number|string, text: string }
 */
function Notification({ message, onClose, duration = 2000 }) {
    // Normalize to an object
    const text = typeof message === "string" ? message : message?.text;
    const key = typeof message === "object" && message ? message.id : text;

    useEffect(() => {
        if (!text) return;
        const t = setTimeout(() => onClose(), duration);
        return () => clearTimeout(t);
        // depend on `key` so identical text still retriggers when id changes
    }, [key, text, onClose, duration]);

    if (!text) return null;

    return (
        <div className="notification">
            <span>{text}</span>
            <button className="close-btn" onClick={onClose}>
                OK
            </button>
        </div>
    );
}

export default Notification;
