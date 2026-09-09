import InfoTooltip from "./InfoTooltip";
import { ChartIcon } from "../icons";
import { formatKpiValue } from "../utils/format";

function ChartButton({ metric, onMetricClick }) {
  if (!onMetricClick) return null;
  return (
    <button
      type="button"
      className="quadrant-chart-btn"
      onClick={() => onMetricClick(metric)}
      aria-label={`Prikaži grafik za ${metric.label}`}
    >
      <ChartIcon />
    </button>
  );
}

export default function QuadrantCard({
  title,
  metrics,
  values,
  loading,
  currency,
  wide,
  onMetricClick,
  bare,
  compareLabel,
}) {
  const [primary, ...subs] = metrics;

  // Most metrics share the card-level currency (store order currency), but
  // some (CAC, pulled from an ad platform) carry their own — e.g. Meta
  // spend in EUR alongside RSD revenue metrics in the same card.
  const renderValue = (metric) =>
    loading || !values
      ? "…"
      : formatKpiValue(metric.format, values[metric.key], values[`${metric.key}Currency`] || currency);

  // null when comparison is off, or when this particular metric has no
  // previous-period value to compare against (e.g. CR/CAC with no
  // GA4/Meta connection) — same shape as RevenueTrendChart's yoyPercent.
  const renderChange = (metric) => {
    if (loading || !values) return null;
    const change = values.changePercent?.[metric.key];
    if (change === null || change === undefined) return null;
    // Sign alone isn't "good" or "bad" the same way for every metric — a
    // rising Return Rate is bad news despite the positive sign, so the
    // badge color follows each metric's own goodDirection instead of just
    // whether `change` is positive.
    const isGoodNews = metric.goodDirection === "down" ? change <= 0 : change >= 0;
    return (
      <span
        className={"yoy-badge quadrant-yoy-badge " + (isGoodNews ? "up" : "down")}
        title={compareLabel}
      >
        {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  if (wide) {
    // Unlike the 2-metric quadrants below, this row's metrics (LTV, RPR,
    // TBO, CLV, CAC) are peers, not a headline + supporting stats — giving
    // the first one (LTV, just by array order in kpiDefinitions.js) the
    // large "primary" treatment made it visually dominate the other four
    // for no real reason. All five render at the same (sub) size instead.
    const row = (
      <div className="quadrant-wide-row">
        {metrics.map((metric) => (
          <div className="quadrant-wide-stat" key={metric.key}>
            <div className="quadrant-sub-head">
              <span className="quadrant-sub-label">{metric.label}</span>
              <span className="quadrant-head-icons">
                <InfoTooltip text={metric.definition} />
                <ChartButton metric={metric} onMetricClick={onMetricClick} />
              </span>
            </div>
            <div className="quadrant-sub-value">
              {renderValue(metric)}
              {renderChange(metric)}
            </div>
          </div>
        ))}
      </div>
    );

    if (bare) return row;

    return (
      <div className="quadrant-card quadrant-card-wide">
        {title && <p className="quadrant-title">{title}</p>}
        {row}
      </div>
    );
  }

  return (
    <div className="quadrant-card">
      <p className="quadrant-title">{title}</p>

      <div className="quadrant-primary">
        <div className="quadrant-primary-head">
          <span className="quadrant-primary-label">{primary.label}</span>
          <span className="quadrant-head-icons">
            <InfoTooltip text={primary.definition} />
            <ChartButton metric={primary} onMetricClick={onMetricClick} />
          </span>
        </div>
        <div className="quadrant-primary-value">
          {renderValue(primary)}
          {renderChange(primary)}
        </div>
      </div>

      {subs.length > 0 && (
        <div className="quadrant-subs">
          {subs.map((metric) => (
            <div className="quadrant-sub" key={metric.key}>
              <div className="quadrant-sub-head">
                <span className="quadrant-sub-label">{metric.label}</span>
                <span className="quadrant-head-icons">
                  <InfoTooltip text={metric.definition} />
                  <ChartButton metric={metric} onMetricClick={onMetricClick} />
                </span>
              </div>
              <div className="quadrant-sub-value">
                {renderValue(metric)}
                {renderChange(metric)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
