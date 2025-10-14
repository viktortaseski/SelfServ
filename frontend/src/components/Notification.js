import { useEffect, useCallback, useRef, useState } from "react";
import "./components-style/Notification.css";

function Notification({ message, id, onClose, duration = 4000 }) {
    const startYRef = useRef(null);
    const offsetRef = useRef(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        offsetRef.current = dragOffset;
    }, [dragOffset]);

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

    const handleTouchStart = (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;
        startYRef.current = touch.clientY;
        setIsDragging(true);
        setDragOffset(0);
    };

    const handleTouchMove = (e) => {
        if (!isDragging || startYRef.current == null) return;
        const touch = e.touches?.[0];
        if (!touch) return;
        const delta = touch.clientY - startYRef.current;
        if (delta < 0) {
            e.preventDefault?.();
            const clamped = Math.max(delta, -160);
            setDragOffset(clamped);
        } else {
            setDragOffset(Math.min(delta, 24));
        }
    };

    const finishGesture = (shouldClose) => {
        setIsDragging(false);
        startYRef.current = null;
        if (shouldClose) {
            setDragOffset(-200);
            requestAnimationFrame(() => onClose?.());
        } else {
            setDragOffset(0);
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        const shouldClose = offsetRef.current <= -60;
        finishGesture(shouldClose);
    };

    const handleTouchCancel = () => {
        if (!isDragging) return;
        finishGesture(false);
    };

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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            style={{ "--notif-fade-delay": `${fadeDelayMs}ms` }}
        >
            <div
                className={`notification-body ${isDragging ? "is-dragging" : ""}`}
                style={{ transform: `translateY(${dragOffset}px)` }}
            >
                <span className="notif-icon" aria-hidden="true">✓</span>
                <span className="notif-text">{message}</span>
                <button className="notif-btn" onClick={onClose}>OK</button>
            </div>
        </div>
    );
}

export default Notification;
