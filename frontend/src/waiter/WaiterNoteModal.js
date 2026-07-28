function WaiterNoteModal({ open, itemName, value, onChange, onClose, onSave }) {
    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave?.();
    };

    return (
        <div className="waiter-modal waiter-note-modal__overlay">
            <form className="waiter-modal__content waiter-note-modal" onSubmit={handleSubmit}>
                <div className="waiter-note-modal__header">
                    <span className="waiter-note-modal__tag">NOTE</span>
                    <h3 className="waiter-note-modal__item-name">{itemName || "Item"}</h3>
                </div>
                <textarea
                    className="waiter-note-modal__textarea"
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder="Add any special request..."
                    maxLength={120}
                    rows={4}
                    autoFocus
                />
                <p className="waiter-note-modal__hint">Max 120 characters. Leave empty to remove the note.</p>
                <div className="waiter-note-modal__actions">
                    <button
                        type="button"
                        className="waiter-note-modal__btn waiter-note-modal__btn--cancel"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="waiter-note-modal__btn waiter-note-modal__btn--save">
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
}

export default WaiterNoteModal;
