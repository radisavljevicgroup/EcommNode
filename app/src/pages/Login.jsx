import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, PersonIcon } from "../icons";
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

export default function Login({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Pogrešan mejl ili lozinka."
            : signInError.message
        );
        return;
      }

      onNavigate("home");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      promptText="Nemaš nalog?"
      ctaLabel="Registruj se"
      ctaRoute="register"
      onNavigate={onNavigate}
    >
      <h1 className="auth-title">Prijavi se</h1>
      <p className="auth-subtitle">
        Nastavi tamo gde si stao uz <span>EcommNode</span>
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

        <AuthField label="Lozinka" icon={LockIcon}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Vaša lozinka"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="auth-eye-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Sakrij lozinku" : "Prikaži lozinku"}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </AuthField>

        <div className="auth-forgot-row">
          <button
            type="button"
            className="auth-link"
            onClick={() => onNavigate("zaboravljena-lozinka")}
          >
            Zaboravio/la si lozinku?
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Prijavljivanje…" : "Prijavi se"}
          <PersonIcon />
        </button>
      </form>

      <p className="auth-footer">
        Nemaš nalog?{" "}
        <button type="button" className="auth-link" onClick={() => onNavigate("register")}>
          Registruj se
        </button>
      </p>
    </AuthLayout>
  );
}
