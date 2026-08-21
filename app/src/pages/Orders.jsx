import { useEffect, useState } from "react";
import { fetchWooOrders, fetchWooStatus } from "../api/woocommerce";
import { EyeIcon } from "../icons";
import { siteLabel } from "../utils/site";

const STATUS_META = {
  pending: { label: "Na čekanju", className: "pending" },
  processing: { label: "U obradi", className: "processing" },
  "on-hold": { label: "Na čekanju", className: "onhold" },
  completed: { label: "Završeno", className: "completed" },
  cancelled: { label: "Otkazano", className: "cancelled" },
  refunded: { label: "Refundirano", className: "refunded" },
  failed: { label: "Neuspešno", className: "failed" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, className: "default" };
  return (
    <span className={"order-status-badge order-status-" + meta.className}>
      {meta.label}
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}. ${pad(d.getMonth() + 1)}. ${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatAddress(address) {
  if (!address) return "";
  return [
    address.address1,
    address.address2,
    [address.postcode, address.city].filter(Boolean).join(" "),
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function sameAddress(a, b) {
  if (!a || !b) return false;
  return (
    a.address1 === b.address1 &&
    a.city === b.city &&
    a.postcode === b.postcode &&
    a.country === b.country
  );
}

function OrderCard({ order, expanded, onToggle }) {
  const billingLine = formatAddress(order.billing);
  const shippingLine = formatAddress(order.shipping);
  const shippingDiffers =
    order.shipping && shippingLine && !sameAddress(order.billing, order.shipping);

  return (
    <div className="order-card">
      <button type="button" className="order-card-header" onClick={onToggle}>
        <span className="order-card-eye">
          <EyeIcon />
        </span>
        <div className="order-card-main">
          <p className="order-card-id">
            #{order.number || order.id}
            {order.sourceSiteUrl && (
              <span className="order-source-tag">{siteLabel(order.sourceSiteUrl)}</span>
            )}
          </p>
          <p className="order-card-date">{formatDateTime(order.dateCreated)}</p>
        </div>
        <div className="order-card-meta">
          <StatusBadge status={order.status} />
          <div className="order-card-total">
            <strong>
              {order.total} {order.currency}
            </strong>
            <span>{order.items.length} stavke porudžbine</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="order-card-body">
          <div className="order-card-grid">
            <div>
              <p className="order-card-label">Kupac</p>
              <p className="order-card-value">
                {order.billing.firstName} {order.billing.lastName}
              </p>
              {order.billing.email && (
                <p className="order-card-value muted">{order.billing.email}</p>
              )}
              {order.billing.phone && (
                <p className="order-card-value muted">{order.billing.phone}</p>
              )}
            </div>

            <div>
              <p className="order-card-label">Adresa za naplatu</p>
              <p className="order-card-value">{billingLine || "—"}</p>
            </div>

            <div>
              <p className="order-card-label">Adresa za dostavu</p>
              <p className="order-card-value">
                {shippingDiffers ? shippingLine : "Ista kao adresa za naplatu"}
              </p>
            </div>

            <div>
              <p className="order-card-label">Plaćanje i dostava</p>
              <p className="order-card-value">{order.paymentMethod || "—"}</p>
              <p className="order-card-value muted">{order.shippingMethod || "—"}</p>
            </div>
          </div>

          {order.customerNote && (
            <p className="order-card-note">
              <strong>Napomena: </strong>
              {order.customerNote}
            </p>
          )}

          <div className="orders-items-table-wrap">
            <table className="orders-items-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Proizvod</th>
                  <th>Šifra</th>
                  <th>Količina</th>
                  <th>Cena</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.image ? (
                        <img
                          className="order-item-thumb"
                          src={item.image}
                          alt={item.name}
                        />
                      ) : (
                        <div className="order-item-thumb placeholder" />
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>{item.sku || "—"}</td>
                    <td>{item.quantity}</td>
                    <td>
                      {item.price} {order.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="orders-list">
      {[0, 1, 2].map((i) => (
        <div className="order-card order-skeleton" key={i}>
          <div className="skeleton-line" style={{ width: "40%" }} />
          <div className="skeleton-line" style={{ width: "60%" }} />
          <div className="skeleton-line" style={{ width: "25%" }} />
        </div>
      ))}
    </div>
  );
}

export default function Orders() {
  const [connections, setConnections] = useState([]);
  const [selectedId, setSelectedId] = useState("all");
  const [orders, setOrders] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchWooStatus()
      .then((data) => setConnections(data.connections || []))
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  useEffect(() => {
    if (connections.length === 0) return;
    let cancelled = false;
    setLoadingOrders(true);
    setError("");

    const targets =
      selectedId === "all"
        ? connections
        : connections.filter((c) => c.id === selectedId);

    Promise.all(
      targets.map((c) =>
        fetchWooOrders(c.id).then((data) =>
          data.orders.map((o) => ({
            ...o,
            sourceSiteUrl: connections.length > 1 ? c.siteUrl : null,
          }))
        )
      )
    )
      .then((lists) => {
        if (cancelled) return;
        const merged = lists
          .flat()
          .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
        setOrders(merged);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, connections]);

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const partner = `${o.billing.firstName} ${o.billing.lastName}`.toLowerCase();
    return (
      String(o.id).includes(q) ||
      String(o.number || "").includes(q) ||
      partner.includes(q)
    );
  });

  const loading = loadingStatus || loadingOrders;

  return (
    <div className="page-body orders-page">
      <div className="orders-page-header">
        <div>
          <h1 className="settings-title">Porudžbine</h1>
          <p className="orders-breadcrumb">Nadzorna tabla / Porudžbine</p>
        </div>
        <div className="orders-search">
          <input
            type="text"
            placeholder="Pretraži po partneru, broju..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="orders-search-btn">
            Pretraži
          </button>
        </div>
      </div>

      {connections.length > 1 && (
        <div className="filter-tabs">
          <button
            type="button"
            className={"filter-tab" + (selectedId === "all" ? " active" : "")}
            onClick={() => setSelectedId("all")}
          >
            Sve integracije
          </button>
          {connections.map((c) => (
            <button
              key={c.id}
              type="button"
              className={"filter-tab" + (selectedId === c.id ? " active" : "")}
              onClick={() => setSelectedId(c.id)}
            >
              {siteLabel(c.siteUrl)}
            </button>
          ))}
        </div>
      )}

      {loadingStatus ? (
        <OrdersSkeleton />
      ) : connections.length === 0 ? (
        <div className="empty-hint">
          Poveži WooCommerce u Podešavanja → Integracije da bi video porudžbine.
        </div>
      ) : loading ? (
        <OrdersSkeleton />
      ) : error ? (
        <div className="woo-error">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-hint">Nema porudžbina za prikaz.</div>
      ) : (
        <div className="orders-list">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === order.id ? null : order.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
