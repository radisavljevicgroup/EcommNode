import { useState, useEffect } from "react";
import Header, { NAV_ITEMS } from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Calendar from "./pages/Calendar";
import Analytics from "./pages/Analytics";
import ItInfrastruktura from "./pages/ItInfrastruktura";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import EmptyHome from "./pages/EmptyHome";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import DataDeletion from "./pages/legal/DataDeletion";
import { supabase } from "./lib/supabaseClient";
import { isRouteAllowed, EMPTY_HOME_ROLES } from "./lib/roles";

const AUTH_ROUTES = new Set(["login", "register", "zaboravljena-lozinka", "nova-lozinka"]);
// Reachable without a session — the marketing landing page, the auth flow,
// and the legal pages (their URLs are what get pasted into the Meta App
// Dashboard's Privacy Policy / Terms of Service / Data Deletion Instructions
// fields, and Meta's reviewer opens them logged out). Everything else
// (dashboard, orders, analytics...) requires being signed in.
const LEGAL_ROUTES = new Set(["privatnost", "uslovi-koriscenja", "brisanje-podataka"]);
const PUBLIC_ROUTES = new Set([...AUTH_ROUTES, "landing", ...LEGAL_ROUTES]);
const ROUTES = new Set([...NAV_ITEMS.map((i) => i.route), ...PUBLIC_ROUTES]);

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  // Supabase's password-recovery redirect appends #access_token=...&type=recovery
  // to the site URL — catch that before the normal route lookup. Matching on
  // bare "access_token=" alone (dropped 2026-09-11) also caught Meta's OAuth
  // popup landing back here with its own #access_token=... hash (when it
  // falls back to a top-level redirect instead of postMessage — e.g. no
  // Valid OAuth Redirect URI configured, or third-party cookies blocked),
  // wrongly routing a Facebook login into the "change your password" screen.
  // type=recovery is the actual, specific marker Supabase adds.
  if (hash.includes("type=recovery")) {
    return "nova-lozinka";
  }
  const route = hash.split("?")[0];
  // Bare domain, no hash at all — that's the public landing page, not the
  // (session-gated) dashboard "home" route.
  if (!route) return "landing";
  return ROUTES.has(route) ? route : "home";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash());
  const [photo, setPhoto] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [settingsSection, setSettingsSection] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const loadProfile = async (userId) => {
      const { data } = await supabase
        .from("users")
        .select("photo, full_name, roles(name)")
        .eq("id", userId)
        .single();
      setPhoto(data?.photo || "");
      setFullName(data?.full_name || "");
      setRoleName(data?.roles?.name || "");
    };

    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data?.user);
      setAuthChecked(true);
      if (data?.user) loadProfile(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      setAuthChecked(true);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setPhoto("");
        setFullName("");
        setRoleName("");
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const navigate = (r) => {
    window.location.hash = "/" + r;
    setRoute(r.split("?")[0]);
  };

  const openSettingsSection = (sectionId) => {
    setSettingsSection(sectionId);
    navigate("podesavanja");
  };

  // Keeps the hash in sync once we know there's no session — the content
  // below already renders Login directly in the same pass, so this is just
  // cleanup for the URL bar and for reload/back-forward, not what avoids
  // a flash of protected content.
  useEffect(() => {
    if (authChecked && !isAuthenticated && !PUBLIC_ROUTES.has(route)) {
      window.location.hash = "/login";
      setRoute("login");
    }
  }, [authChecked, isAuthenticated, route]);

  // The landing page is the default for a bare, unauthenticated visit —
  // but someone who's already signed in and hits the bare domain (or an
  // old #/landing bookmark) should land straight in the app, not on
  // marketing copy.
  useEffect(() => {
    if (authChecked && isAuthenticated && route === "landing") {
      window.location.hash = "/home";
      setRoute("home");
    }
  }, [authChecked, isAuthenticated, route]);

  if (route === "landing") return <Landing onNavigate={navigate} />;
  if (route === "privatnost") return <Privacy />;
  if (route === "uslovi-koriscenja") return <Terms />;
  if (route === "brisanje-podataka") return <DataDeletion />;
  if (route === "login") return <Login onNavigate={navigate} />;
  if (route === "register") return <Register onNavigate={navigate} />;
  if (route === "zaboravljena-lozinka") return <ForgotPassword onNavigate={navigate} />;
  if (route === "nova-lozinka") return <ResetPassword onNavigate={navigate} />;

  if (!authChecked) return null;
  if (!isAuthenticated) return <Login onNavigate={navigate} />;

  // Direct hash navigation to a route hidden from this role's nav collapses
  // to the (empty) home page, same as the hidden nav items.
  const effectiveRoute = isRouteAllowed(roleName, route) ? route : "home";

  return (
    <>
      <Header
        route={effectiveRoute}
        onNavigate={navigate}
        photo={photo}
        fullName={fullName}
        onOpenSettingsSection={openSettingsSection}
        roleName={roleName}
      />
      {effectiveRoute === "podesavanja" ? (
        <Settings
          onPhotoChange={setPhoto}
          initialSection={settingsSection}
          onSectionConsumed={() => setSettingsSection(null)}
        />
      ) : effectiveRoute === "porudzbine" ? (
        <Orders />
      ) : effectiveRoute === "kalendar" ? (
        <Calendar />
      ) : effectiveRoute === "analitika" ? (
        <Analytics />
      ) : effectiveRoute === "it-infrastruktura" ? (
        <ItInfrastruktura />
      ) : EMPTY_HOME_ROLES.has(roleName) ? (
        <EmptyHome />
      ) : (
        <Dashboard />
      )}
    </>
  );
}
