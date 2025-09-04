import { useEffect } from "react";
import "./components-style/Notification.css";

function Notification({ message, onClose }) {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                onClose();
            }, 2000); // 2 seconds
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className="notification">
            <span>{message}</span>
            <button className="close-btn" onClick={onClose}>OK</button>
        </div>
    );
}

export default Notification;
