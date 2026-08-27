import { useEffect, useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { LockIcon, EyeIcon, EyeOffIcon, PersonIcon } from "../icons";
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

export default function ResetPassword({ onNavigate }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(!!data?.session);
      setCheckingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Lozinka mora imati najmanje 8 karaktera.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lozinke se ne poklapaju.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await supabase.auth.signOut();
      setDone(true);
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
      <h1 className="auth-title">Nova lozinka</h1>

      {done ? (
        <>
          <p className="auth-subtitle">Lozinka je uspešno promenjena.</p>
          <button className="auth-submit" type="button" onClick={() => onNavigate("login")}>
            Prijavi se
            <PersonIcon />
          </button>
        </>
      ) : checkingSession ? (
        <p className="auth-subtitle">Proveravam link…</p>
      ) : !hasSession ? (
        <>
          <p className="auth-subtitle">
            Link je nevažeći ili je istekao. Zatraži novi link za reset lozinke.
          </p>
          <button
            className="auth-submit"
            type="button"
            onClick={() => onNavigate("zaboravljena-lozinka")}
          >
            Zatraži novi link
            <PersonIcon />
          </button>
        </>
      ) : (
        <>
          <p className="auth-subtitle">Postavi novu lozinku za svoj nalog.</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <AuthField label="Nova lozinka (najmanje 8 karaktera)" icon={LockIcon}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nova lozinka"
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

            <AuthField label="Ponovi lozinku" icon={LockIcon}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Ponovi lozinku"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </AuthField>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Čuvanje…" : "Sačuvaj novu lozinku"}
              <PersonIcon />
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
