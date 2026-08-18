import { formatTableLabel } from "./tableLabel";

function WaiterTableSelect({ tables = [], selectedTableId, onSelectTable, loading }) {
    return (
        <section className="waiter-section">
            <div className="waiter-table-list">
                {loading && tables.length === 0 ? (
                    <div className="waiter-placeholder">Loading tables…</div>
                ) : null}
                {!loading && tables.length === 0 ? (
                    <div className="waiter-placeholder">
                        No tables available yet. Try refreshing.
                    </div>
                ) : null}
                {tables.map((table) => {
                    const isSelected = table.id === selectedTableId;
                    const openCount = Number(table.openOrders ?? table.open_orders ?? 0);
                    const statusText =
                        table.status ||
                        (openCount > 0
                            ? `${openCount} open ${openCount === 1 ? "order" : "orders"}`
                            : "Available");
                    const stateClass =
                        openCount > 0 ? "waiter-table--busy" : "waiter-table--available";
                    const classes = ["waiter-table", stateClass];
                    if (isSelected) classes.push("waiter-table--selected");
                    return (
                        <button
                            key={table.id}
                            type="button"
                            className={classes.join(" ")}
                            onClick={() => onSelectTable(table.id)}
                        >
                            <span className="waiter-table__name">
                                {formatTableLabel(table)}
                            </span>
                            <span className="waiter-table__status">{statusText}</span>
                            {isSelected ? (
                                <span className="waiter-table__selected-label">Selected</span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export default WaiterTableSelect;
