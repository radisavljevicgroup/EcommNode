export default function IntegrationGroupCard({
  icon,
  iconAlt,
  iconNode,
  name,
  connections,
  countLabel,
  addLabel,
  onConnectClick,
  renderRow,
}) {
  return (
    <div className="woo-integration-card">
      <div className="woo-integration-head">
        <span className="integration-badge">{iconNode || <img src={icon} alt={iconAlt} />}</span>
        <div className="integration-info">
          <p className="integration-name">
            {name}
            <span className="status-pill">Povezano</span>
          </p>
          <p className="integration-site">{countLabel(connections.length)}</p>
        </div>
        {onConnectClick && (
          <button
            className="tool-card-open-btn tool-card-open-btn-inline"
            type="button"
            onClick={onConnectClick}
          >
            {addLabel}
          </button>
        )}
      </div>

      <div className="meta-account-list">{connections.map(renderRow)}</div>
    </div>
  );
}
