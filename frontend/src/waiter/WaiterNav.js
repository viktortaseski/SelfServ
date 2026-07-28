function WaiterNav({
  step,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onHome,
  onManageOrders,
  disableForward,
}) {
  const forwardLabel = step === "summary" ? "Submit" : "Next";

  return (
    <nav className="waiter-nav">
      <button
        type="button"
        className="waiter-nav__button waiter-nav__button--home"
        onClick={onHome}
      >
        Home
      </button>
      <button
        type="button"
        className="waiter-nav__button waiter-nav__button--orders"
        onClick={() => onManageOrders?.()}
      >
        Orders
      </button>
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
        className="waiter-nav__button waiter-nav__button--primary"
        onClick={onForward}
        disabled={!canGoForward || disableForward}
      >
        {forwardLabel}
      </button>
    </nav>
  );
}

export default WaiterNav;
