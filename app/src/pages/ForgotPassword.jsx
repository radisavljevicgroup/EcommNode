import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { MailIcon, PersonIcon } from "../icons";
import { supabase } from "../lib/supabaseClient";

function AuthField({ label, icon: Icon, children }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">
          <Icon />
        </span>
        {children}
      </div>
    </label>
  );
}

export default function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setNotice("Ako nalog sa ovim mejlom postoji, poslali smo link za reset lozinke.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      promptText="Setio/la si se lozinke?"
      ctaLabel="Prijavi se"
      ctaRoute="login"
      onNavigate={onNavigate}
    >
      <h1 className="auth-title">Zaboravljena lozinka</h1>
      <p className="auth-subtitle">
        Unesi mejl naloga i poslaćemo ti link za postavljanje nove lozinke.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField label="Mejl" icon={MailIcon}>
          <input
            type="email"
            placeholder="petar@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </AuthField>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Slanje…" : "Pošalji link"}
          <PersonIcon />
        </button>
      </form>

      <p className="auth-footer">
        Setio/la si se lozinke?{" "}
        <button type="button" className="auth-link" onClick={() => onNavigate("login")}>
          Prijavi se
        </button>
      </p>
    </AuthLayout>
  );
}
