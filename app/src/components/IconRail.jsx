import { HomeIcon, CpuIcon, ToolsIcon } from "../icons";

export const RAIL_ITEMS = [
  { key: "meni", icon: HomeIcon, label: "Glavni meni" },
  { key: "integracije", icon: CpuIcon, label: "Integracija" },
  { key: "apps", icon: ToolsIcon, label: "Svi alati" },
];

export default function IconRail({ items = RAIL_ITEMS, active, onSelect }) {
  return (
    <nav className="icon-rail">
      {items.map(({ key, icon: Icon, label }) => (
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
