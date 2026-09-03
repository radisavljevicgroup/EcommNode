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
import { supabase } from "./lib/supabaseClient";

const AUTH_ROUTES = new Set(["login", "register", "zaboravljena-lozinka", "nova-lozinka"]);
// Reachable without a session — the marketing landing page plus the auth
// flow itself. Everything else (dashboard, orders, analytics...) requires
// being signed in.
const PUBLIC_ROUTES = new Set([...AUTH_ROUTES, "landing"]);
const ROUTES = new Set([...NAV_ITEMS.map((i) => i.route), ...PUBLIC_ROUTES]);

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  // Supabase's password-recovery redirect appends #access_token=...&type=recovery
  // to the site URL — catch that before the normal route lookup.
  if (hash.includes("type=recovery") || hash.includes("access_token=")) {
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
        .select("photo, full_name")
        .eq("id", userId)
        .single();
      setPhoto(data?.photo || "");
      setFullName(data?.full_name || "");
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
  if (route === "login") return <Login onNavigate={navigate} />;
  if (route === "register") return <Register onNavigate={navigate} />;
  if (route === "zaboravljena-lozinka") return <ForgotPassword onNavigate={navigate} />;
  if (route === "nova-lozinka") return <ResetPassword onNavigate={navigate} />;

  if (!authChecked) return null;
  if (!isAuthenticated) return <Login onNavigate={navigate} />;

  return (
    <>
      <Header
        route={route}
        onNavigate={navigate}
        photo={photo}
        fullName={fullName}
        onOpenSettingsSection={openSettingsSection}
      />
      {route === "podesavanja" ? (
        <Settings
          onPhotoChange={setPhoto}
          initialSection={settingsSection}
          onSectionConsumed={() => setSettingsSection(null)}
        />
      ) : route === "porudzbine" ? (
        <Orders />
      ) : route === "kalendar" ? (
        <Calendar />
      ) : route === "analitika" ? (
        <Analytics />
      ) : route === "it-infrastruktura" ? (
        <ItInfrastruktura />
      ) : (
        <Dashboard />
      )}
    </>
  );
}
