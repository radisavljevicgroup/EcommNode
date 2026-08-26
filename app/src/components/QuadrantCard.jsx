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
}) {
  const [primary, ...subs] = metrics;

  const renderValue = (metric) =>
    loading || !values ? "…" : formatKpiValue(metric.format, values[metric.key], currency);

  if (wide) {
    const row = (
      <div className="quadrant-wide-row">
        <div className="quadrant-wide-stat quadrant-wide-primary">
          <div className="quadrant-primary-head">
            <span className="quadrant-primary-label">{primary.label}</span>
            <span className="quadrant-head-icons">
              <InfoTooltip text={primary.definition} />
              <ChartButton metric={primary} onMetricClick={onMetricClick} />
            </span>
          </div>
          <div className="quadrant-primary-value">{renderValue(primary)}</div>
        </div>

        {subs.map((metric) => (
          <div className="quadrant-wide-stat" key={metric.key}>
            <div className="quadrant-sub-head">
              <span className="quadrant-sub-label">{metric.label}</span>
              <span className="quadrant-head-icons">
                <InfoTooltip text={metric.definition} />
                <ChartButton metric={metric} onMetricClick={onMetricClick} />
              </span>
            </div>
            <div className="quadrant-sub-value">{renderValue(metric)}</div>
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
        <div className="quadrant-primary-value">{renderValue(primary)}</div>
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
              <div className="quadrant-sub-value">{renderValue(metric)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
