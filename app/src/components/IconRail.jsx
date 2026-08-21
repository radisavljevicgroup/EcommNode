import { HomeIcon, CpuIcon, GridIcon } from "../icons";

export const RAIL_ITEMS = [
  { key: "meni", icon: HomeIcon, label: "Glavni meni" },
  { key: "integracije", icon: CpuIcon, label: "Integracija" },
  { key: "apps", icon: GridIcon, label: "Svi alati" },
];

export default function IconRail({ active, onSelect }) {
  return (
    <nav className="icon-rail">
      {RAIL_ITEMS.map(({ key, icon: Icon, label }) => (
        <div
          className={"icon-rail-item" + (active === key ? " active" : "")}
          key={key}
        >
          <button
            className="icon-rail-btn"
            type="button"
            aria-label={label}
            onClick={() => onSelect(key)}
          >
            <Icon />
          </button>
          <span className="icon-rail-tooltip">{label}</span>
        </div>
      ))}
    </nav>
  );
}
