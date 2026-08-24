import InfoTooltip from "./InfoTooltip";
import { formatKpiValue } from "../utils/format";

export default function QuadrantCard({ title, metrics, values, loading, currency, wide }) {
  const [primary, ...subs] = metrics;

  const renderValue = (metric) =>
    loading || !values ? "…" : formatKpiValue(metric.format, values[metric.key], currency);

  if (wide) {
    return (
      <div className="quadrant-card quadrant-card-wide">
        <p className="quadrant-title">{title}</p>
        <div className="quadrant-wide-row">
          <div className="quadrant-wide-stat quadrant-wide-primary">
            <div className="quadrant-primary-head">
              <span className="quadrant-primary-label">{primary.label}</span>
              <InfoTooltip text={primary.definition} />
            </div>
            <div className="quadrant-primary-value">{renderValue(primary)}</div>
          </div>

          {subs.map((metric, i) => (
            <div className="quadrant-wide-stat" key={metric.key}>
              <div className="quadrant-sub-head">
                <span className="quadrant-sub-letter">{String.fromCharCode(97 + i)}.</span>
                <span className="quadrant-sub-label">{metric.label}</span>
                <InfoTooltip text={metric.definition} />
              </div>
              <div className="quadrant-sub-value">{renderValue(metric)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="quadrant-card">
      <p className="quadrant-title">{title}</p>

      <div className="quadrant-primary">
        <div className="quadrant-primary-head">
          <span className="quadrant-primary-label">{primary.label}</span>
          <InfoTooltip text={primary.definition} />
        </div>
        <div className="quadrant-primary-value">{renderValue(primary)}</div>
      </div>

      {subs.length > 0 && (
        <div className="quadrant-subs">
          {subs.map((metric, i) => (
            <div className="quadrant-sub" key={metric.key}>
              <div className="quadrant-sub-head">
                <span className="quadrant-sub-letter">{String.fromCharCode(97 + i)}.</span>
                <span className="quadrant-sub-label">{metric.label}</span>
                <InfoTooltip text={metric.definition} />
              </div>
              <div className="quadrant-sub-value">{renderValue(metric)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
