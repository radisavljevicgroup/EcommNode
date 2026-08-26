import Logo from "./Logo";
import { PersonIcon, BagIcon, ChartIcon, OrdersIcon } from "../icons";

export default function AuthLayout({ promptText, ctaLabel, ctaRoute, onNavigate, children }) {
  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Logo />
        <div className="auth-topbar-cta">
          <span>{promptText}</span>
          <button type="button" className="auth-topbar-btn" onClick={() => onNavigate(ctaRoute)}>
            {ctaLabel}
            <PersonIcon />
          </button>
        </div>
      </header>

      <div className="auth-main">
        <div className="auth-card">{children}</div>

        <div className="auth-visual">
          <div className="auth-visual-mockup">
            <span className="auth-visual-badge">
              <BagIcon />
            </span>
            <div className="auth-visual-bars">
              <span style={{ width: "80%" }} />
              <span style={{ width: "55%" }} />
              <span style={{ width: "68%" }} />
            </div>
            <div className="auth-visual-row">
              <span>
                <ChartIcon />
              </span>
              <span>
                <OrdersIcon />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
