import { useState, useEffect } from "react";
import Header, { NAV_ITEMS } from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";

const ROUTES = new Set(NAV_ITEMS.map((i) => i.route));

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return ROUTES.has(hash) ? hash : "home";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash());

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (r) => {
    window.location.hash = "/" + r;
    setRoute(r);
  };

  return (
    <>
      <Header route={route} onNavigate={navigate} />
      {route === "podesavanja" ? <Settings /> : <Dashboard />}
    </>
  );
}
