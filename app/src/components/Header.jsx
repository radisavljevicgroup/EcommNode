import Logo from "./Logo";
import { HomeIcon, GearIcon, OrdersIcon, ChartIcon } from "../icons";

export const NAV_ITEMS = [
  { route: "home", label: "Početna", icon: HomeIcon },
  { route: "porudzbine", label: "Porudžbine", icon: OrdersIcon },
  { route: "analitika", label: "Analitika", icon: ChartIcon },
  { route: "podesavanja", label: "Podešavanja", icon: GearIcon },
];

export default function Header({ route, onNavigate }) {
  return (
    <header className="topbar">
      <Logo />

      <nav className="nav-pill">
        {NAV_ITEMS.map(({ route: r, label, icon: Icon }) => (
          <button
            key={r}
            className={"nav-item" + (route === r ? " active" : "")}
            onClick={() => onNavigate(r)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <div className="badge-slot" title="logo dolazi kasnije" />
    </header>
  );
}
