import { useEffect, useState } from "react";
import { fetchWooOrders, fetchWooStatus, fetchStaleOrderCount } from "../api/woocommerce";
import { EyeIcon } from "../icons";
import { siteLabel } from "../utils/site";
import Pagination from "../components/Pagination";
import MultiSelect from "../components/MultiSelect";
import { ORDER_STATUS_OPTIONS } from "../constants/orderStatuses";

const PER_PAGE_OPTIONS = [10, 20, 30, 50];

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

function FiscalBadge({ fiscalized }) {
  return (
    <span
      className={"order-status-badge " + (fiscalized ? "order-fiscal-yes" : "order-fiscal-no")}
    >
      {fiscalized ? "Fiskalizovano" : "Nefiskalizovano"}
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
          <FiscalBadge fiscalized={order.fiscalized} />
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
  const [pagination, setPagination] = useState({ page: 1, perPage: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(
    ORDER_STATUS_OPTIONS.map((s) => s.id)
  );
  const [fiscalFilter, setFiscalFilter] = useState("all");
  // Never activated automatically — only the explicit button click below
  // (or the "Ukloni filter" button to undo it) changes this.
  const [staleOnly, setStaleOnly] = useState(false);
  const [staleCount, setStaleCount] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchWooStatus()
      .then((data) => setConnections(data.connections || []))
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  useEffect(() => {
    fetchStaleOrderCount()
      .then((data) => setStaleCount(data.count || 0))
      .catch(() => {});
  }, [staleOnly]);

  const statusesKey = selectedStatuses.join(",");

  useEffect(() => {
    if (connections.length === 0) return;
    let cancelled = false;
    setLoadingOrders(true);
    setError("");

    fetchWooOrders(selectedId === "all" ? undefined : selectedId, {
      page,
      perPage,
      search,
      stale: staleOnly,
      // The stale view has its own fixed status semantics (pending/processing
      // only) — don't cross it with this filter.
      status: staleOnly || selectedStatuses.length === ORDER_STATUS_OPTIONS.length
        ? undefined
        : selectedStatuses,
    })
      .then((data) => {
        if (cancelled) return;
        setOrders(data.orders);
        setPagination(data.pagination);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, selectedId, page, perPage, search, staleOnly, statusesKey]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handlePerPageChange = (e) => {
    setPerPage(Number(e.target.value));
    setPage(1);
  };

  const handleStoreChange = (id) => {
    setSelectedId(id);
    setPage(1);
  };

  const handleStatusChange = (ids) => {
    setSelectedStatuses(ids);
    setPage(1);
  };

  const showStaleOrders = () => {
    setStaleOnly(true);
    setPage(1);
  };

  const clearStaleFilter = () => {
    setStaleOnly(false);
    setPage(1);
  };

  const loading = loadingStatus || loadingOrders;

  // Fiscalization isn't a WooCommerce-native filter, so this only narrows
  // down the orders already loaded on the current page (not a server-wide
  // filter across all pages).
  const visibleOrders = orders.filter((o) => {
    if (fiscalFilter === "yes") return o.fiscalized;
    if (fiscalFilter === "no") return !o.fiscalized;
    return true;
  });

  return (
    <div className="page-body orders-page">
      <div className="orders-page-header">
        <div>
          <h1 className="settings-title">Porudžbine</h1>
          <p className="orders-breadcrumb">Nadzorna tabla / Porudžbine</p>
        </div>
        <form className="orders-search" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Pretraži po partneru, broju..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="orders-search-btn">
            Pretraži
          </button>
        </form>
      </div>

      {staleOnly ? (
        <div className="stale-filter-banner">
          <span>
            Prikazane su samo zastarele porudžbine (Na čekanju / U obradi, starije od
            praga iz podešavanja).
          </span>
          <button type="button" onClick={clearStaleFilter}>
            Ukloni filter
          </button>
        </div>
      ) : (
        staleCount > 0 && (
          <div className="stale-filter-banner stale-filter-prompt">
            <span>Imaš {staleCount} zastarelih porudžbina koje čekaju obradu.</span>
            <button type="button" onClick={showStaleOrders}>
              Vidi zastarele porudžbine
            </button>
          </div>
        )
      )}

      <div className="orders-toolbar">
        {connections.length > 1 && (
          <div className="filter-tabs">
            <button
              type="button"
              className={"filter-tab" + (selectedId === "all" ? " active" : "")}
              onClick={() => handleStoreChange("all")}
            >
              Sve integracije
            </button>
            {connections.map((c) => (
              <button
                key={c.id}
                type="button"
                className={"filter-tab" + (selectedId === c.id ? " active" : "")}
                onClick={() => handleStoreChange(c.id)}
              >
                {siteLabel(c.siteUrl)}
              </button>
            ))}
          </div>
        )}

        <MultiSelect
          options={ORDER_STATUS_OPTIONS}
          selected={selectedStatuses}
          onChange={handleStatusChange}
          placeholder="Izaberi status"
          allLabel="Svi statusi"
          countLabel={(n) => `${n} status${n === 1 ? "" : "a"} izabrano`}
          emptyLabel="Nijedan status izabran"
        />

        <label className="per-page-select">
          Fiskalizacija:
          <select value={fiscalFilter} onChange={(e) => setFiscalFilter(e.target.value)}>
            <option value="all">Sve</option>
            <option value="yes">Fiskalizovano</option>
            <option value="no">Nefiskalizovano</option>
          </select>
        </label>

        <label className="per-page-select">
          Po stranici:
          <select value={perPage} onChange={handlePerPageChange}>
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

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
      ) : orders.length === 0 ? (
        <div className="empty-hint">Nema porudžbina za prikaz.</div>
      ) : visibleOrders.length === 0 ? (
        <div className="empty-hint">
          Nema porudžbina koje odgovaraju filteru fiskalizacije na ovoj stranici.
        </div>
      ) : (
        <>
          <div className="orders-list">
            {visibleOrders.map((order) => (
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
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
