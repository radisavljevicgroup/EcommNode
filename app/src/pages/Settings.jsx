import { useEffect, useRef, useState } from "react";
import IconRail from "../components/IconRail";
import { AccordionRow, InputRow, ToggleRow } from "../components/FormRows";
import Toast from "../components/Toast";
import { PersonIcon, BellIcon, CreditCardIcon, LogOutIcon, UsersIcon, BuildingIcon } from "../icons";
import IntegrationsSection from "./integracije/IntegrationsSection";
import AlatiSection from "./alati/AlatiSection";
import { supabase } from "../lib/supabaseClient";
import { addWorker, fetchWorkers, updateWorker } from "../api/workers";
import { fetchFirma, updateFirma } from "../api/firma";

const CAN_ADD_WORKERS = new Set(["E-commerce Manager", "E-commerce Operations Manager", "CEO"]);

export default function Settings({ onPhotoChange, initialSection, onSectionConsumed }) {
  const [open, setOpen] = useState("nalog");
  const [section, setSection] = useState("meni");

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState("");
  const [roleName, setRoleName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [sendingReset, setSendingReset] = useState(false);

  const [firmaPib, setFirmaPib] = useState("");
  const [firmaNaziv, setFirmaNaziv] = useState("");
  const [loadingFirma, setLoadingFirma] = useState(false);
  const [savingFirma, setSavingFirma] = useState(false);

  const [roles, setRoles] = useState([]);
  const [workerFullName, setWorkerFullName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerPassword, setWorkerPassword] = useState("");
  const [workerRoleId, setWorkerRoleId] = useState("");
  const [workerPhoto, setWorkerPhoto] = useState("");
  const [addingWorker, setAddingWorker] = useState(false);

  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editPhoto, setEditPhoto] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));

  const showToast = (type, message) => {
    setToast({ type, message });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const user = data?.user || null;
      setAuthUser(user);
      if (!user) {
        setCheckingAuth(false);
        return;
      }
      setEmail(user.email || "");
      supabase
        .from("users")
        .select("full_name, phone, photo, roles(name)")
        .eq("id", user.id)
        .single()
        .then(({ data: profile, error }) => {
          if (cancelled || error || !profile) return;
          setFullName(profile.full_name || "");
          setPhone(profile.phone || "");
          setPhoto(profile.photo || "");
          setRoleName(profile.roles?.name || "");
        })
        .finally(() => {
          if (!cancelled) setCheckingAuth(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onPhotoChange?.(photo);
  }, [photo, onPhotoChange]);

  useEffect(() => {
    if (initialSection) {
      setOpen(initialSection);
      onSectionConsumed?.();
    }
  }, [initialSection, onSectionConsumed]);

  useEffect(() => {
    if (!authUser) return;
    supabase
      .from("roles")
      .select("id, name")
      .then(({ data }) => setRoles(data || []));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    setLoadingFirma(true);
    fetchFirma()
      .then(({ firma }) => {
        setFirmaPib(firma.pib || "");
        setFirmaNaziv(firma.naziv || "");
      })
      .catch(() => {})
      .finally(() => setLoadingFirma(false));
  }, [authUser]);

  const handleSaveFirma = async () => {
    if (!firmaNaziv.trim()) {
      showToast("error", "Naziv firme je obavezan.");
      return;
    }
    setSavingFirma(true);
    try {
      await updateFirma({ naziv: firmaNaziv.trim() });
      showToast("success", "Naziv firme je sačuvan.");
    } catch (err) {
      showToast("error", err.message || "Nije moguće sačuvati naziv firme.");
    } finally {
      setSavingFirma(false);
    }
  };

  const loadWorkers = () => {
    if (!CAN_ADD_WORKERS.has(roleName)) return;
    setLoadingWorkers(true);
    fetchWorkers()
      .then(({ workers: list }) => setWorkers(list || []))
      .catch(() => {})
      .finally(() => setLoadingWorkers(false));
  };

  useEffect(() => {
    loadWorkers();
  }, [roleName]);

  const assignableRoles = roles.filter((r) => r.name !== "Owner");

  const handleSave = async () => {
    if (!authUser) return;
    setSaving(true);
    try {
      // pib/naziv are firma-level now (see handleSaveFirma) — this only
      // ever touches this account's own personal profile fields.
      const { error } = await supabase
        .from("users")
        .update({ full_name: fullName, phone, photo })
        .eq("id", authUser.id);
      if (error) throw error;

      const emailChanged = email.trim() && email.trim() !== authUser.email;
      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
        if (emailError) throw emailError;
        showToast(
          "success",
          "Izmene su sačuvane. Da bi email bio promenjen, potvrdi to preko linka koji stiže na mejl."
        );
      } else {
        showToast("success", "Izmene su sačuvane.");
      }
    } catch (err) {
      showToast("error", err.message || "Nije moguće sačuvati izmene.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !authUser) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${authUser.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("Avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("Avatars").getPublicUrl(path);
      setPhoto(`${data.publicUrl}?t=${Date.now()}`);
      showToast("success", "Slika je otpremljena — klikni Sačuvaj izmene da je zadržiš.");
    } catch (err) {
      showToast("error", err.message || "Nije moguće otpremiti sliku.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleWorkerPhotoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setWorkerPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAddWorker = async () => {
    if (!workerFullName.trim() || !workerEmail.trim() || !workerRoleId) {
      showToast("error", "Ime, email i rola su obavezni.");
      return;
    }
    if (workerPassword.length < 8) {
      showToast("error", "Lozinka mora imati najmanje 8 karaktera.");
      return;
    }
    setAddingWorker(true);
    try {
      await addWorker({
        fullName: workerFullName.trim(),
        phone: workerPhone.trim(),
        email: workerEmail.trim(),
        password: workerPassword,
        roleId: workerRoleId,
        photo: workerPhoto || null,
      });
      showToast("success", "Radnik je dodat.");
      setWorkerFullName("");
      setWorkerPhone("");
      setWorkerEmail("");
      setWorkerPassword("");
      setWorkerRoleId("");
      setWorkerPhoto("");
      loadWorkers();
    } catch (err) {
      showToast("error", err.message || "Nije moguće dodati radnika.");
    } finally {
      setAddingWorker(false);
    }
  };

  const startEditWorker = (w) => {
    setEditingWorkerId(w.id);
    setEditFullName(w.fullName);
    setEditPhone(w.phone || "");
    setEditRoleId(roles.find((r) => r.name === w.role)?.id || "");
    setEditPhoto("");
  };

  const cancelEditWorker = () => {
    setEditingWorkerId(null);
  };

  const handleEditWorkerPhotoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSaveWorkerEdit = async () => {
    if (!editFullName.trim() || !editRoleId) {
      showToast("error", "Ime i rola su obavezni.");
      return;
    }
    setSavingEdit(true);
    try {
      await updateWorker(editingWorkerId, {
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        roleId: editRoleId,
        photo: editPhoto || null,
      });
      showToast("success", "Izmene su sačuvane.");
      setEditingWorkerId(null);
      loadWorkers();
    } catch (err) {
      showToast("error", err.message || "Nije moguće sačuvati izmene.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!authUser?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      showToast("success", "Poslali smo link za reset lozinke na tvoj mejl.");
    } catch (err) {
      showToast("error", err.message || "Nije moguće poslati link za reset.");
    } finally {
      setSendingReset(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.hash = "/login";
  };

  return (
    <div className="settings-layout">
      <IconRail active={section} onSelect={setSection} />

      <div className="settings-main">
        <div className="settings-wrap">
          {section === "integracije" ? (
            <IntegrationsSection />
          ) : section === "apps" ? (
            <AlatiSection />
          ) : (
            <>
              <div className="settings-header">
                <h1 className="settings-title">Podešavanja</h1>
                <p className="settings-subtitle">
                  Upravljajte nalogom, obaveštenjima i plaćanjima.
                </p>
              </div>

              {checkingAuth ? (
                <div className="empty-hint">Učitavanje naloga…</div>
              ) : !authUser ? (
                <div className="empty-hint">
                  Nisi prijavljen —{" "}
                  <a href="#/login" className="auth-link">
                    prijavi se
                  </a>{" "}
                  da bi video i uredio nalog.
                </div>
              ) : (
                <>
                  <div className="account-card">
                    <div className="account-name-block">
                      {photo ? (
                        <img className="account-avatar" src={photo} alt="" />
                      ) : (
                        <span className="account-avatar-placeholder">
                          <PersonIcon />
                        </span>
                      )}
                      <div className="account-name-fields">
                        <p className="account-name-label">Ime i prezime</p>
                        <input
                          className="account-name-input"
                          type="text"
                          placeholder="Unesite ime i prezime"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    </div>

                    <AccordionRow
                      id="nalog"
                      icon={PersonIcon}
                      label="Uredi nalog"
                      open={open === "nalog"}
                      onToggle={toggle}
                    >
                      <InputRow
                        label="Email za prijavu"
                        desc="Promena zahteva potvrdu preko linka na mejlu"
                        type="email"
                        value={email}
                        onChange={setEmail}
                      />
                      <InputRow
                        label="Broj telefona"
                        desc="Kontakt broj naloga"
                        value={phone}
                        onChange={setPhone}
                      />
                      <div className="settings-row">
                        <div>
                          <p className="settings-row-label">Slika profila</p>
                          <p className="settings-row-desc">JPG ili PNG, otprema se odmah</p>
                        </div>
                        <label className="btn-save photo-upload-btn">
                          {uploadingPhoto ? "Otpremanje…" : "Izaberi fajl"}
                          <input
                            className="photo-upload-input"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            disabled={uploadingPhoto}
                          />
                        </label>
                      </div>
                      <InputRow
                        label="Rola"
                        desc="Dodeljuje se automatski prilikom registracije"
                        value={roleName}
                        readOnly
                      />
                      <div className="settings-row">
                        <div>
                          <p className="settings-row-label">Lozinka</p>
                          <p className="settings-row-desc">Pošalji sebi link za postavljanje nove lozinke</p>
                        </div>
                        <button
                          className="btn-save"
                          type="button"
                          onClick={handleSendPasswordReset}
                          disabled={sendingReset}
                        >
                          {sendingReset ? "Slanje…" : "Pošalji link za reset"}
                        </button>
                      </div>
                    </AccordionRow>

                    <AccordionRow
                      id="firma"
                      icon={BuildingIcon}
                      label="Firma"
                      open={open === "firma"}
                      onToggle={toggle}
                    >
                      <InputRow
                        label="PIB"
                        desc="Poreski identifikacioni broj — jedinstven po firmi, ne može se menjati ovde"
                        value={loadingFirma ? "Učitavanje…" : firmaPib}
                        readOnly
                      />
                      {CAN_ADD_WORKERS.has(roleName) ? (
                        <div className="settings-row">
                          <div>
                            <p className="settings-row-label">Naziv firme</p>
                            <p className="settings-row-desc">Vidljivo svim radnicima firme</p>
                          </div>
                          <input
                            className="account-name-input"
                            type="text"
                            placeholder="Naziv firme"
                            value={firmaNaziv}
                            onChange={(e) => setFirmaNaziv(e.target.value)}
                          />
                        </div>
                      ) : (
                        <InputRow
                          label="Naziv firme"
                          desc="Menja ga vlasnik ili menadžer firme"
                          value={loadingFirma ? "Učitavanje…" : firmaNaziv}
                          readOnly
                        />
                      )}
                      {CAN_ADD_WORKERS.has(roleName) && (
                        <button
                          className="btn-save"
                          type="button"
                          onClick={handleSaveFirma}
                          disabled={savingFirma || loadingFirma}
                        >
                          {savingFirma ? "Čuvanje…" : "Sačuvaj naziv firme"}
                        </button>
                      )}
                    </AccordionRow>

                    {CAN_ADD_WORKERS.has(roleName) && (
                      <AccordionRow
                        id="radnici"
                        icon={UsersIcon}
                        label="Radnici"
                        open={open === "radnici"}
                        onToggle={toggle}
                      >
                        <InputRow
                          label="Ime i prezime"
                          desc="Puno ime novog radnika"
                          value={workerFullName}
                          onChange={setWorkerFullName}
                        />
                        <InputRow
                          label="Broj telefona"
                          desc="Opciono — kontakt broj radnika"
                          value={workerPhone}
                          onChange={setWorkerPhone}
                        />
                        <InputRow
                          label="Email za prijavu"
                          desc="Radnik se prijavljuje ovim mejlom"
                          type="email"
                          value={workerEmail}
                          onChange={setWorkerEmail}
                        />
                        <InputRow
                          label="Lozinka"
                          desc="Najmanje 8 karaktera — saopšti je radniku"
                          type="password"
                          value={workerPassword}
                          onChange={setWorkerPassword}
                        />
                        <div className="settings-row">
                          <div>
                            <p className="settings-row-label">Rola</p>
                            <p className="settings-row-desc">Određuje dozvole radnika u sistemu</p>
                          </div>
                          <select
                            className="settings-input"
                            value={workerRoleId}
                            onChange={(e) => setWorkerRoleId(e.target.value)}
                          >
                            <option value="">Izaberi rolu</option>
                            {assignableRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="settings-row">
                          <div>
                            <p className="settings-row-label">Slika profila</p>
                            <p className="settings-row-desc">Opciono, JPG ili PNG</p>
                          </div>
                          <label className="btn-save photo-upload-btn">
                            {workerPhoto ? "Slika izabrana" : "Izaberi fajl"}
                            <input
                              className="photo-upload-input"
                              type="file"
                              accept="image/*"
                              onChange={handleWorkerPhotoSelect}
                            />
                          </label>
                        </div>
                        <div className="settings-row">
                          <div>
                            <p className="settings-row-label">Firma</p>
                            <p className="settings-row-desc">
                              Radnik automatski pripada istoj firmi kao nalog koji ga je dodao.
                            </p>
                          </div>
                        </div>
                        <div className="settings-actions">
                          <button
                            className="btn-save"
                            type="button"
                            onClick={handleAddWorker}
                            disabled={addingWorker}
                          >
                            {addingWorker ? "Dodavanje…" : "Dodaj radnika"}
                          </button>
                        </div>

                        <p className="worker-list-heading">Postojeći radnici</p>
                        {loadingWorkers ? (
                          <p className="settings-row-desc">Učitavanje radnika…</p>
                        ) : workers.length === 0 ? (
                          <p className="settings-row-desc">Još uvek nema dodatih radnika.</p>
                        ) : (
                          workers.map((w) =>
                            editingWorkerId === w.id ? (
                              <div className="worker-edit-block" key={w.id}>
                                <InputRow
                                  label="Ime i prezime"
                                  value={editFullName}
                                  onChange={setEditFullName}
                                />
                                <InputRow
                                  label="Broj telefona"
                                  desc="Opciono"
                                  value={editPhone}
                                  onChange={setEditPhone}
                                />
                                <div className="settings-row">
                                  <div>
                                    <p className="settings-row-label">Rola</p>
                                  </div>
                                  <select
                                    className="settings-input"
                                    value={editRoleId}
                                    onChange={(e) => setEditRoleId(e.target.value)}
                                  >
                                    <option value="">Izaberi rolu</option>
                                    {assignableRoles.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="settings-row">
                                  <div>
                                    <p className="settings-row-label">Slika profila</p>
                                    <p className="settings-row-desc">Opciono — zameni sliku</p>
                                  </div>
                                  <label className="btn-save photo-upload-btn">
                                    {editPhoto ? "Slika izabrana" : "Izaberi fajl"}
                                    <input
                                      className="photo-upload-input"
                                      type="file"
                                      accept="image/*"
                                      onChange={handleEditWorkerPhotoSelect}
                                    />
                                  </label>
                                </div>
                                <div className="settings-actions">
                                  <button
                                    className="btn-save"
                                    type="button"
                                    onClick={handleSaveWorkerEdit}
                                    disabled={savingEdit}
                                  >
                                    {savingEdit ? "Čuvanje…" : "Sačuvaj"}
                                  </button>
                                  <button
                                    className="btn-save"
                                    type="button"
                                    onClick={cancelEditWorker}
                                    disabled={savingEdit}
                                  >
                                    Otkaži
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="settings-row" key={w.id}>
                                <div className="worker-row-info">
                                  {w.photo ? (
                                    <img className="worker-avatar" src={w.photo} alt="" />
                                  ) : (
                                    <span className="worker-avatar-placeholder">
                                      <PersonIcon />
                                    </span>
                                  )}
                                  <div>
                                    <p className="settings-row-label">{w.fullName}</p>
                                    <p className="settings-row-desc">
                                      {w.role}
                                      {w.phone ? ` · ${w.phone}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <button className="btn-save" type="button" onClick={() => startEditWorker(w)}>
                                  Uredi
                                </button>
                              </div>
                            )
                          )
                        )}
                      </AccordionRow>
                    )}

                    <AccordionRow
                      id="obavestenja"
                      icon={BellIcon}
                      label="Obaveštenja"
                      open={open === "obavestenja"}
                      onToggle={toggle}
                    >
                      <ToggleRow
                        label="Email obaveštenja"
                        desc="Statusi pošiljki i dnevni izveštaji"
                        soon
                      />
                      <ToggleRow
                        label="SMS obaveštenja"
                        desc="Obaveštenje kada je paket preuzet"
                        soon
                      />
                      <ToggleRow
                        label="Nedeljni izveštaj"
                        desc="Sumarni pregled poslatih i obrisanih pošiljki"
                        soon
                      />
                    </AccordionRow>

                    <AccordionRow
                      id="placanja"
                      icon={CreditCardIcon}
                      label="Plaćanja"
                      open={open === "placanja"}
                      onToggle={toggle}
                    >
                      <div className="settings-row">
                        <div>
                          <p className="settings-row-label">Nema sačuvanih kartica</p>
                          <p className="settings-row-desc">
                            Dodajte način plaćanja za automatsku naplatu
                          </p>
                        </div>
                        <button className="btn-save" type="button">
                          Dodaj karticu
                        </button>
                      </div>
                    </AccordionRow>

                    <AccordionRow
                      id="odjava"
                      icon={LogOutIcon}
                      label="Odjavi se"
                      danger
                      onToggle={handleLogout}
                    />
                  </div>

                  <div className="settings-actions">
                    <button className="btn-save" onClick={handleSave} disabled={saving}>
                      {saving ? "Čuvanje…" : "Sačuvaj izmene"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <Toast type={toast?.type} message={toast?.message} />
    </div>
  );
}
