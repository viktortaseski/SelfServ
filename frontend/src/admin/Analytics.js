import { useMemo, useState } from "react";
import {
  apiFetchOrdersAdmin,
  DEFAULT_FROM_STR,
  DEFAULT_TO_STR,
  fmtMKD,
} from "./dashboardApi";
import "./dashboard.css";

function Stat({ label, value }) {
  return (
    <div className="stat-box">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default function Analytics() {
  const [fromDate, setFromDate] = useState(DEFAULT_FROM_STR());
  const [toDate, setToDate] = useState(DEFAULT_TO_STR());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    setBusy(true);
    setErr("");
    try {
      const fromISO = `${fromDate}T00:00:00`;
      const toISO = `${toDate}T23:59:59`;
      const rows = await apiFetchOrdersAdmin({ from: fromISO, to: toISO, limit: 1000 });
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (e2) {
      setErr(e2?.message || "Fetch error");
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const totalOrders = orders.length;
    let totalItems = 0;
    let revenue = 0;
    for (const o of orders) {
      totalItems += (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
      revenue += Number(o.subtotal || 0) + Number(o.tip || 0);
    }
    return { totalOrders, totalItems, revenue };
  }, [orders]);

  const byDow = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const d = new Date(o.created_at);
      const k = d.getDay(); // 0..6
      if (!map.has(k)) map.set(k, { orders: 0, revenue: 0 });
      const row = map.get(k);
      row.orders += 1;
      row.revenue += Number(o.subtotal || 0) + Number(o.tip || 0);
    }
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, v]) => ({ label: names[idx], ...v }));
  }, [orders]);

  const topItems = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      for (const it of o.items || []) {
        const k = String(it.name || "");
        if (!map.has(k)) map.set(k, { qty: 0, revenue: 0 });
        const row = map.get(k);
        row.qty += Number(it.quantity || 0);
        row.revenue += Number(it.price || 0) * Number(it.quantity || 0);
      }
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);
  }, [orders]);

  return (
    <div className="grid gap-10">
      <section className="card">
        <h3 className="mt-0">Analytics & Reporting</h3>
        <div className="filters-grid">
          <label className="form-label">
            From date
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
          </label>
          <label className="form-label">
            To date
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
          </label>
          <div className="self-end">
            <button onClick={fetchOrders} disabled={busy} className="btn btn-primary">
              {busy ? "Loading…" : "Run report"}
            </button>
          </div>
        </div>
        {err ? <div className="error-text">{err}</div> : null}
      </section>

      <section className="card">
        <h3 className="mt-0">Quick totals</h3>
        <div className="stats-row">
          <Stat label="Orders" value={totals.totalOrders} />
          <Stat label="Items" value={totals.totalItems} />
          <Stat label="Revenue" value={fmtMKD(totals.revenue)} />
        </div>
      </section>

      <section className="card">
        <h3 className="mt-0">By day of week</h3>
        {!byDow.length ? (
          <div className="muted">Run a report to see data.</div>
        ) : (
          <div className="grid gap-8">
            {byDow.map((r) => (
              <div key={r.label} className="month-row">
                <div>{r.label}</div>
                <div>{r.orders} orders</div>
                <div>{fmtMKD(r.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="mt-0">Top items</h3>
        {!topItems.length ? (
          <div className="muted">Run a report to see data.</div>
        ) : (
          <div className="grid gap-8">
            {topItems.map((t) => (
              <div key={t.name} className="month-row">
                <div>{t.name}</div>
                <div>{t.qty} sold</div>
                <div>{fmtMKD(t.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

