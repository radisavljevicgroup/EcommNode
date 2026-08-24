import { useEffect, useState } from "react";
import IconRail from "../components/IconRail";
import { AccordionRow, InputRow, ToggleRow } from "../components/FormRows";
import { PersonIcon, BellIcon, CreditCardIcon, LogOutIcon } from "../icons";
import IntegrationsSection from "./IntegrationsSection";
import { fetchSettings, updateSettings } from "../api/settings";

export default function Settings() {
  const [name, setName] = useState("");
  const [open, setOpen] = useState("nalog");
  const [section, setSection] = useState("meni");

  const [staleThreshold, setStaleThreshold] = useState("");
  const [staleSaved, setStaleSaved] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((data) => setStaleThreshold(String(data.staleOrderThresholdDays ?? 30)))
      .catch(() => {});
  }, []);

  const saveStaleThreshold = () => {
    const n = Number(staleThreshold);
    if (!Number.isFinite(n) || n <= 0) return;
    updateSettings({ staleOrderThresholdDays: n })
      .then(() => {
        setStaleSaved(true);
        setTimeout(() => setStaleSaved(false), 2000);
      })
      .catch(() => {});
  };

  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));

  return (
    <div className="settings-layout">
      <IconRail active={section} onSelect={setSection} />

      <div className="settings-main">
        <div className="settings-wrap">
          {section === "integracije" ? (
            <IntegrationsSection />
          ) : (
            <>
              <div className="settings-header">
                <h1 className="settings-title">Podešavanja</h1>
                <p className="settings-subtitle">
                  Upravljajte nalogom, obaveštenjima i plaćanjima.
                </p>
              </div>

              <div className="account-card">
                <div className="account-name-block">
                  <p className="account-name-label">Ime i prezime</p>
                  <input
                    className="account-name-input"
                    type="text"
                    placeholder="Unesite ime i prezime"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <AccordionRow
                  id="nalog"
                  icon={PersonIcon}
                  label="Uredi nalog"
                  open={open === "nalog"}
                  onToggle={toggle}
                >
                  <InputRow
                    label="Naziv kompanije"
                    desc="Prikazuje se na nalepnicama i fakturama"
                    defaultValue="Paketomat d.o.o."
                  />
                  <InputRow
                    label="Email za prijavu"
                    desc="Koristi se za pristup nalogu"
                    type="email"
                    defaultValue="office@paketomat.io"
                  />
                  <InputRow
                    label="Broj telefona"
                    desc="Kontakt za kurirsku službu"
                    defaultValue="060/063-89-63"
                  />
                </AccordionRow>

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
                    defaultChecked
                  />
                  <ToggleRow
                    label="SMS obaveštenja"
                    desc="Obaveštenje kada je paket preuzet"
                  />
                  <ToggleRow
                    label="Nedeljni izveštaj"
                    desc="Sumarni pregled poslatih i obrisanih pošiljki"
                    defaultChecked
                  />
                  <div className="settings-row">
                    <div>
                      <p className="settings-row-label">
                        Prag za zastarele porudžbine (dana)
                      </p>
                      <p className="settings-row-desc">
                        Nezavršena porudžbina starija od ovog broja dana prijavljuje se
                        kao zastarela
                      </p>
                    </div>
                    <div className="stale-threshold-field">
                      <input
                        className="settings-input"
                        type="number"
                        min="1"
                        value={staleThreshold}
                        onChange={(e) => setStaleThreshold(e.target.value)}
                        onBlur={saveStaleThreshold}
                      />
                      {staleSaved && <span className="stale-saved-hint">Sačuvano</span>}
                    </div>
                  </div>
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
                  onToggle={() => {}}
                />
              </div>

              <div className="settings-actions">
                <button className="btn-save">Sačuvaj izmene</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
