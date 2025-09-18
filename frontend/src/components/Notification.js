import { useEffect } from "react";
import "./components-style/Notification.css";

function Notification({ message, id, onClose }) {
    // Re-run timer every time "id" changes (even if message text is identical)
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [id, message, onClose]);

    if (!message) return null;

    return (
        <div className="notification">
            <span>{message}</span>
            <button className="close-btn" onClick={onClose}>OK</button>
        </div>
    );
}

export default Notification;
