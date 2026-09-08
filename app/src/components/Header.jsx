import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import {
  HomeIcon,
  GearIcon,
  OrdersIcon,
  ChartIcon,
  PersonIcon,
  LogOutIcon,
  CalendarIcon,
  ServerIcon,
  MenuIcon,
  CloseIcon,
} from "../icons";
import { supabase } from "../lib/supabaseClient";
import { RESTRICTED_ROLES, RESTRICTED_NAV_ROUTES, ROLE_HIDDEN_ROUTES } from "../lib/roles";

export const NAV_ITEMS = [
  { route: "home", label: "Početna", icon: HomeIcon },
  { route: "porudzbine", label: "Porudžbine", icon: OrdersIcon },
  { route: "analitika", label: "Analitika", icon: ChartIcon },
  { route: "kalendar", label: "Kalendar", icon: CalendarIcon },
  { route: "it-infrastruktura", label: "IT Infrastruktura", icon: ServerIcon },
  { route: "podesavanja", label: "Podešavanja", icon: GearIcon },
];

export default function Header({ route, onNavigate, photo, fullName, onOpenSettingsSection, roleName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef(null);

  const visibleNavItems = RESTRICTED_ROLES.has(roleName)
    ? NAV_ITEMS.filter((item) => RESTRICTED_NAV_ROUTES.has(item.route))
    : NAV_ITEMS.filter((item) => !ROLE_HIDDEN_ROUTES[roleName]?.has(item.route));

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  // Closing on route change covers both a nav tap and the browser back/
  // forward buttons — anywhere the visible page changes out from under an
  // open mobile drawer.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [route]);

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
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label={mobileNavOpen ? "Zatvori meni" : "Otvori meni"}
        aria-expanded={mobileNavOpen}
        onClick={() => setMobileNavOpen((v) => !v)}
      >
        {mobileNavOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      <Logo />

      <nav className="nav-pill">
        {visibleNavItems.map(({ route: r, label, icon: Icon }) => (
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
            <button type="button" className="menu-row danger" onClick={handleLogout}>
              <LogOutIcon />
              <span>Odjavi se</span>
            </button>
          </div>
        )}
      </div>

      {mobileNavOpen && (
        <>
          <button
            type="button"
            className="mobile-nav-backdrop"
            aria-label="Zatvori meni"
            onClick={() => setMobileNavOpen(false)}
          />
          <nav className="mobile-nav-sheet">
            {visibleNavItems.map(({ route: r, label, icon: Icon }) => (
              <button
                key={r}
                className={"mobile-nav-item" + (route === r ? " active" : "")}
                onClick={() => onNavigate(r)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
