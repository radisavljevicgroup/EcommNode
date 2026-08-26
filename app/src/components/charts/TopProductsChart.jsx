import { siteLabel } from "../../utils/site";

function formatMoney(value, currency) {
  return `${Math.round(value).toLocaleString("sr-RS")} ${currency}`;
}

function formatUnits(value) {
  return `${Math.round(value).toLocaleString("sr-RS")} kom`;
}

export default function TopProductsChart({
  bestsellers,
  categories,
  currency,
  showSiteTag,
  sortBy = "revenue",
  onSortByChange,
}) {
  return (
    <>
      <div className="chart-card">
        <div className="chart-card-head">
          <h3>Top proizvodi</h3>
          {onSortByChange && (
            <div className="filter-tabs">
              <button
                type="button"
                className={"filter-tab" + (sortBy === "revenue" ? " active" : "")}
                onClick={() => onSortByChange("revenue")}
              >
                Po prihodu
              </button>
              <button
                type="button"
                className={"filter-tab" + (sortBy === "units" ? " active" : "")}
                onClick={() => onSortByChange("units")}
              >
                Po količini
              </button>
            </div>
          )}
        </div>
        <p className="chart-subtitle">
          Deset najprodavanijih proizvoda u izabranom periodu (
          {sortBy === "units" ? "po prodatoj količini" : "po prihodu"})
        </p>

        {bestsellers.length === 0 ? (
          <div className="empty-hint">Nema podataka.</div>
        ) : (
          <div className="top-products-grid">
            {bestsellers.map((p, i) => (
              <div className="top-product-card" key={p.id || p.name}>
                <span className="top-product-rank">#{i + 1}</span>
                {p.image ? (
                  <img className="top-product-img" src={p.image} alt={p.name} />
                ) : (
                  <div className="top-product-img placeholder" />
                )}
                <p className="top-product-name">{p.name}</p>
                {p.sku && <p className="top-product-sku">Šifra: {p.sku}</p>}
                <p className="top-product-revenue">
                  {sortBy === "units" ? formatUnits(p.units) : formatMoney(p.revenue, currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chart-card">
        <h3>Top kategorije</h3>
        <p className="chart-subtitle">Deset kategorija sa najvećim prihodom</p>

        {categories.length === 0 ? (
          <div className="empty-hint">Nema podataka.</div>
        ) : (
          <div className="top-categories-grid">
            {categories.map((c) => (
              <div className="top-category-card" key={`${c.site || ""}::${c.name}`}>
                {c.image ? (
                  <img className="top-category-img" src={c.image} alt={c.name} />
                ) : (
                  <div className="top-category-img placeholder">{c.name[0]}</div>
                )}
                <p className="top-category-name">{c.name}</p>
                {showSiteTag && c.site && (
                  <span className="order-source-tag top-category-site">
                    {siteLabel(c.site)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
