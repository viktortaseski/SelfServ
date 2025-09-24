import { useEffect, useCallback } from "react";
import "./components-style/Notification.css";

function Notification({ message, id, onClose, duration = 4000 }) {
    // Reset auto-close whenever the id changes
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [id, message, duration, onClose]);

    const onKeyDown = useCallback(
        (e) => { if (e.key === "Escape") onClose?.(); },
        [onClose]
    );

    if (!message) return null;

    // Pass the fade-out delay to CSS (total minus enter+exit animation time ~450ms)
    const fadeDelayMs = Math.max(0, duration - 450);

    return (
        <div
            className="notification"
            role="status"
            aria-live="polite"
            onKeyDown={onKeyDown}
            tabIndex={0}
            style={{ ["--notif-fade-delay"]: `${fadeDelayMs}ms` }}
        >
            <span className="notif-icon" aria-hidden="true">✓</span>
            <span className="notif-text">{message}</span>
            <button className="notif-btn" onClick={onClose}>OK</button>
        </div>
    );
}

export default Notification;
