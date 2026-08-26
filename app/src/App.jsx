import { useState, useEffect } from "react";
import Header, { NAV_ITEMS } from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";

const AUTH_ROUTES = new Set(["login", "register"]);
const ROUTES = new Set([...NAV_ITEMS.map((i) => i.route), ...AUTH_ROUTES]);

function routeFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const route = hash.split("?")[0];
  return ROUTES.has(route) ? route : "home";
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
    setRoute(r.split("?")[0]);
  };

  if (route === "login") return <Login onNavigate={navigate} />;
  if (route === "register") return <Register onNavigate={navigate} />;

  return (
    <>
      <Header route={route} onNavigate={navigate} />
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
