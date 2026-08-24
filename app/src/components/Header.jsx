import Logo from "./Logo";
import { HomeIcon, ToolsIcon, GearIcon, OrdersIcon, ChartIcon } from "../icons";

export const NAV_ITEMS = [
  { route: "home", label: "Početna", icon: HomeIcon },
  { route: "porudzbine", label: "Porudžbine", icon: OrdersIcon },
  { route: "analitika", label: "Analitika", icon: ChartIcon },
  { route: "alati", label: "Alati", icon: ToolsIcon },
  { route: "podesavanja", label: "Podešavanja", icon: GearIcon },
];

// The stale-orders badge is a passive notification only — it never changes
// where the nav item navigates to. Seeing the filtered list always requires
// an explicit click on the "Vidi zastarele porudžbine" button on the Orders
// page itself.
export default function Header({ route, onNavigate, staleOrdersCount = 0 }) {
  return (
    <header className="topbar">
      <Logo />

      <nav className="nav-pill">
        {NAV_ITEMS.map(({ route: r, label, icon: Icon, count }) => {
          const hasStale = r === "porudzbine" && staleOrdersCount > 0;
          const displayCount = hasStale ? staleOrdersCount : count;
          return (
            <button
              key={r}
              className={"nav-item" + (route === r ? " active" : "")}
              onClick={() => onNavigate(r)}
            >
              <Icon />
              {label}
              {displayCount !== undefined && (
                <span className={"nav-count" + (hasStale ? " nav-count-alert" : "")}>
                  {displayCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="badge-slot" title="logo dolazi kasnije" />
    </header>
  );
}
