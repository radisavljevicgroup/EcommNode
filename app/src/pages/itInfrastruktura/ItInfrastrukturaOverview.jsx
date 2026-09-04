export default function ItInfrastrukturaOverview({ tabs = [], loading, onNavigate }) {
  return (
    <>
      <div className="settings-header">
        <h1 className="settings-title">IT Infrastruktura</h1>
        <p className="settings-subtitle">
          Integracije sa distributerima i poslovnim sistemima koji snabdevaju tvoju prodavnicu —
          automatizacija zaliha, cena i asortimana.
        </p>
      </div>

      {loading ? (
        <div className="empty-hint">Učitavanje…</div>
      ) : tabs.length === 0 ? (
        <div className="empty-hint">
          Trenutno nema dostupnih IT infrastrukturnih integracija.
        </div>
      ) : (
        <div className="integration-grid">
          {tabs.map((tab) => (
            <div className="integration-grid-card" key={tab.key}>
              <span className="integration-badge">
                {tab.logo ? <img src={tab.logo} alt={tab.label} /> : <tab.icon />}
              </span>
              <p className="integration-grid-name">{tab.label}</p>
              <button
                type="button"
                className="integration-grid-action"
                onClick={() => onNavigate(tab.key)}
              >
                Otvori
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
