import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { HomeIcon, GearIcon, OrdersIcon, ChartIcon, PersonIcon, CreditCardIcon, LogOutIcon } from "../icons";
import { supabase } from "../lib/supabaseClient";

export const NAV_ITEMS = [
  { route: "home", label: "Početna", icon: HomeIcon },
  { route: "porudzbine", label: "Porudžbine", icon: OrdersIcon },
  { route: "analitika", label: "Analitika", icon: ChartIcon },
  { route: "podesavanja", label: "Podešavanja", icon: GearIcon },
];

export default function Header({ route, onNavigate, photo, fullName, onOpenSettingsSection }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const goToSettings = (section) => {
    setMenuOpen(false);
    onOpenSettingsSection(section);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    window.location.hash = "/login";
  };

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

      <div className="account-menu" ref={menuRef}>
        <button
          type="button"
          className="account-menu-trigger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Nalog"
        >
          {photo ? (
            <img className="badge-slot-avatar" src={photo} alt="" />
          ) : (
            <div className="badge-slot" title="logo dolazi kasnije" />
          )}
        </button>

        {menuOpen && (
          <div className="account-menu-dropdown">
            {fullName && <p className="account-menu-name">{fullName}</p>}
            <button type="button" className="menu-row" onClick={() => goToSettings("nalog")}>
              <PersonIcon />
              <span>Uredi nalog</span>
            </button>
            <button type="button" className="menu-row" onClick={() => goToSettings("placanja")}>
              <CreditCardIcon />
              <span>Plaćanja</span>
            </button>
            <button type="button" className="menu-row danger" onClick={handleLogout}>
              <LogOutIcon />
              <span>Odjavi se</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
