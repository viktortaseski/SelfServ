function WaiterNav({
    step,
    canGoBack,
    canGoForward,
    onBack,
    onForward,
    onHome,
    onToggleAccount,
    accountOpen,
    onLogout,
    onViewSales,
    disableForward,
}) {
    const forwardLabel = step === "summary" ? "Submit" : "Next";

    return (
        <nav className="waiter-nav">
            <button
                type="button"
                className="waiter-nav__button"
                onClick={onBack}
                disabled={!canGoBack}
            >
                Back
            </button>
            <button
                type="button"
                className="waiter-nav__button waiter-nav__button--home"
                onClick={onHome}
            >
                Home
            </button>
            <button
                type="button"
                className="waiter-nav__button waiter-nav__button--primary"
                onClick={onForward}
                disabled={!canGoForward || disableForward}
            >
                {forwardLabel}
            </button>
            <div className="waiter-nav__account">
                <button
                    type="button"
                    className={`waiter-nav__button waiter-nav__button--account ${
                        accountOpen ? "waiter-nav__button--active" : ""
                    }`}
                    onClick={onToggleAccount}
                >
                    ...
                </button>
                {accountOpen ? (
                    <div className="waiter-nav__menu">
                        <button
                            type="button"
                            className="waiter-nav__menu-item"
                            onClick={onViewSales}
                        >
                            View sales
                        </button>
                        <button
                            type="button"
                            className="waiter-nav__menu-item waiter-nav__menu-item--danger"
                            onClick={onLogout}
                        >
                            Logout
                        </button>
                    </div>
                ) : null}
            </div>
        </nav>
    );
}

export default WaiterNav;
