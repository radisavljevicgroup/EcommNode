import { HomeIcon, CpuIcon, ToolsIcon } from "../icons";

export const RAIL_ITEMS = [
  { key: "meni", icon: HomeIcon, label: "Glavni meni" },
  { key: "integracije", icon: CpuIcon, label: "Integracija" },
  { key: "apps", icon: ToolsIcon, label: "Svi alati" },
];

export default function IconRail({ items = RAIL_ITEMS, active, onSelect }) {
  return (
    <nav className="icon-rail">
      {items.map(({ key, icon: Icon, label, children }) => {
        const isActive = active === key || children?.some((c) => c.key === active);
        return (
          <div className={"icon-rail-item" + (isActive ? " active" : "")} key={key}>
            <button
              className="icon-rail-btn"
              type="button"
              aria-label={label}
              onClick={() => onSelect(children ? children[0].key : key)}
            >
              <Icon />
            </button>

            {children ? (
              <div className="icon-rail-submenu">
                <p className="icon-rail-submenu-title">{label}</p>
                {children.map((child) => (
                  <button
                    key={child.key}
                    type="button"
                    className={
                      "icon-rail-submenu-item" + (active === child.key ? " active" : "")
                    }
                    onClick={() => onSelect(child.key)}
                  >
                    <child.icon />
                    <span>{child.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="icon-rail-tooltip">{label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
