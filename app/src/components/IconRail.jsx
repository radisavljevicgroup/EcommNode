import { useEffect, useRef, useState } from "react";
import { HomeIcon, CpuIcon, ToolsIcon } from "../icons";

export const RAIL_ITEMS = [
  { key: "meni", icon: HomeIcon, label: "Glavni meni" },
  { key: "integracije", icon: CpuIcon, label: "Integracija" },
  { key: "apps", icon: ToolsIcon, label: "Svi alati" },
];

export default function IconRail({ items = RAIL_ITEMS, active, onSelect }) {
  // Desktop still opens a submenu on :hover (pure CSS). Touch/narrow
  // screens can't rely on hover, so below 900px the submenu used to show
  // whenever its item was .active instead — but an item stays active for
  // as long as the user is anywhere inside that tool, so the submenu had
  // no way to ever close again once opened (it just sat frozen over the
  // page). `openKey` replaces that: a tap toggles it open/closed
  // explicitly, and picking a child or tapping outside closes it.
  const [openKey, setOpenKey] = useState(null);
  const railRef = useRef(null);

  useEffect(() => {
    if (!openKey) return undefined;
    const closeOnOutside = (e) => {
      if (railRef.current && !railRef.current.contains(e.target)) setOpenKey(null);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
    };
  }, [openKey]);

  return (
    <nav className="icon-rail" ref={railRef}>
      {items.map(({ key, icon: Icon, label, children }) => {
        const isActive = active === key || children?.some((c) => c.key === active);
        const isOpen = openKey === key;
        return (
          <div className={"icon-rail-item" + (isActive ? " active" : "") + (isOpen ? " open" : "")} key={key}>
            <button
              className="icon-rail-btn"
              type="button"
              aria-label={label}
              aria-expanded={children ? isOpen : undefined}
              onClick={() => {
                if (children) {
                  onSelect(children[0].key);
                  setOpenKey((prev) => (prev === key ? null : key));
                } else {
                  onSelect(key);
                }
              }}
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
                    onClick={() => {
                      onSelect(child.key);
                      setOpenKey(null);
                    }}
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
