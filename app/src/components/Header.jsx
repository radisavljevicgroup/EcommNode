import Logo from "./Logo";
import { HomeIcon, ToolsIcon, GearIcon, OrdersIcon } from "../icons";

export const NAV_ITEMS = [
  { route: "home", label: "Početna", icon: HomeIcon },
  { route: "porudzbine", label: "Porudžbine", icon: OrdersIcon },
  { route: "alati", label: "Alati", icon: ToolsIcon },
  { route: "podesavanja", label: "Podešavanja", icon: GearIcon },
];

export default function Header({ route, onNavigate }) {
  return (
    <header className="topbar">
      <Logo />

      <nav className="nav-pill">
        {NAV_ITEMS.map(({ route: r, label, icon: Icon, count }) => (
          <button
            key={r}
            className={"nav-item" + (route === r ? " active" : "")}
            onClick={() => onNavigate(r)}
          >
            <Icon />
            {label}
            {count !== undefined && <span className="nav-count">{count}</span>}
          </button>
        ))}
      </nav>

      <div className="badge-slot" title="logo dolazi kasnije" />
    </header>
  );
}
