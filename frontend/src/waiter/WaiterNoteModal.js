function WaiterNoteModal({ open, itemName, value, onChange, onClose, onSave }) {
    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave?.();
    };

    return (
        <div className="waiter-modal waiter-note-modal__overlay">
            <form className="waiter-modal__content waiter-note-modal" onSubmit={handleSubmit}>
                <div className="waiter-modal__header">
                    <h3 className="waiter-modal__title">Note for {itemName || "item"}</h3>
                    <button type="button" className="waiter-modal__close" onClick={onClose}>
                        Close
                    </button>
                </div>
                <div className="waiter-modal__body waiter-note-modal__body">
                    <label className="waiter-note-modal__label">
                        Details
                        <textarea
                            className="waiter-note-modal__textarea"
                            value={value}
                            onChange={(e) => onChange?.(e.target.value)}
                            placeholder="Add any special request..."
                            maxLength={120}
                            rows={4}
                            autoFocus
                        />
                    </label>
                    <p className="waiter-note-modal__hint">Max 120 characters. Leave empty to remove the note.</p>
                </div>
                <div className="waiter-note-modal__actions">
                    <button type="button" className="waiter-btn waiter-btn--ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" className="waiter-btn waiter-btn--primary">
                        Save note
                    </button>
                </div>
            </form>
        </div>
    );
}

export default WaiterNoteModal;
