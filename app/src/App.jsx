import { useState, useEffect } from "react";
import Header, { NAV_ITEMS } from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import { fetchStaleOrderCount } from "./api/woocommerce";

const ROUTES = new Set(NAV_ITEMS.map((i) => i.route));
const STALE_POLL_MS = 60000;

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const route = hash.split("?")[0];
  return ROUTES.has(route) ? route : "home";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash());
  const [staleCount, setStaleCount] = useState(0);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetchStaleOrderCount()
        .then((data) => {
          if (!cancelled) setStaleCount(data.count || 0);
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, STALE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const navigate = (r) => {
    window.location.hash = "/" + r;
    setRoute(r.split("?")[0]);
  };

  return (
    <>
      <Header route={route} onNavigate={navigate} staleOrdersCount={staleCount} />
      {route === "podesavanja" ? (
        <Settings />
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
