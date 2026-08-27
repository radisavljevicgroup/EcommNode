import { useState, useEffect } from "react";
import Header, { NAV_ITEMS } from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { supabase } from "./lib/supabaseClient";

const AUTH_ROUTES = new Set(["login", "register", "zaboravljena-lozinka", "nova-lozinka"]);
const ROUTES = new Set([...NAV_ITEMS.map((i) => i.route), ...AUTH_ROUTES]);

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  // Supabase's password-recovery redirect appends #access_token=...&type=recovery
  // to the site URL — catch that before the normal route lookup.
  if (hash.includes("type=recovery") || hash.includes("access_token=")) {
    return "nova-lozinka";
  }
  const route = hash.split("?")[0];
  return ROUTES.has(route) ? route : "home";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash());
  const [photo, setPhoto] = useState("");
  const [fullName, setFullName] = useState("");
  const [settingsSection, setSettingsSection] = useState(null);

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
      if (data?.user) loadProfile(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else {
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

  if (route === "login") return <Login onNavigate={navigate} />;
  if (route === "register") return <Register onNavigate={navigate} />;
  if (route === "zaboravljena-lozinka") return <ForgotPassword onNavigate={navigate} />;
  if (route === "nova-lozinka") return <ResetPassword onNavigate={navigate} />;

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
      ) : route === "analitika" ? (
        <Analytics />
      ) : (
        <Dashboard />
      )}
    </>
  );
}
