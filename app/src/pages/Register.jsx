import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import {
  PersonIcon,
  PhoneIcon,
  MailIcon,
  BuildingIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from "../icons";
import { supabase } from "../lib/supabaseClient";

function AuthField({ label, icon: Icon, hint, children }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">
          <Icon />
        </span>
        {children}
      </div>
      {hint && <span className="auth-field-hint">{hint}</span>}
    </label>
  );
}

export default function Register({ onNavigate }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pib, setPib] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!/^\d{8,9}$/.test(pib.trim())) {
      setError("PIB mora imati 8 ili 9 cifara.");
      return;
    }
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, pib: pib.trim() },
        },
      });

      if (signUpError) {
        setError(
          signUpError.message === "User already registered"
            ? "Nalog sa ovim mejlom već postoji."
            : signUpError.message
        );
        return;
      }

      if (data.session) {
        onNavigate("home");
      } else {
        setNotice("Nalog je napravljen — proveri mejl da potvrdiš registraciju pre prijave.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      promptText="Već imaš nalog?"
      ctaLabel="Prijavi se"
      ctaRoute="login"
      onNavigate={onNavigate}
    >
      <h1 className="auth-title">Registruj se</h1>
      <p className="auth-subtitle">
        Poveži svoje prodavnice i automatizuj svakodnevni rad uz <span>EcommNode</span>
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField label="Ime i prezime" icon={PersonIcon}>
          <input
            type="text"
            placeholder="Petar Petrović"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </AuthField>

        <AuthField label="Broj telefona" icon={PhoneIcon}>
          <input
            type="tel"
            placeholder="0638433101"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </AuthField>

        <AuthField label="Mejl" icon={MailIcon}>
          <input
            type="email"
            placeholder="petar@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </AuthField>

        <AuthField label="PIB" icon={BuildingIcon} hint="Poreski identifikacioni broj, 8 ili 9 cifara">
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456789"
            value={pib}
            onChange={(e) => setPib(e.target.value.replace(/[^\d]/g, ""))}
            maxLength={9}
            required
          />
        </AuthField>

        <AuthField label="Kreiraj lozinku (Zahteva najmanje 8 karaktera)" icon={LockIcon}>
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

        <AuthField label="Ponovi lozinku" icon={LockIcon}>
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Vaša lozinka"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="auth-eye-toggle"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Sakrij lozinku" : "Prikaži lozinku"}
          >
            {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </AuthField>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Registracija…" : "Registruj se"}
          <PersonIcon />
        </button>
      </form>

      <p className="auth-footer">
        Već imaš nalog?{" "}
        <button type="button" className="auth-link" onClick={() => onNavigate("login")}>
          Prijavi se
        </button>
      </p>
    </AuthLayout>
  );
}
