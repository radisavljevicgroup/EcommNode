import { useState } from "react";
import IconRail from "../components/IconRail";
import { AccordionRow, InputRow, ToggleRow } from "../components/FormRows";
import { PersonIcon, BellIcon, CreditCardIcon, LogOutIcon } from "../icons";
import IntegrationsSection from "./integracije/IntegrationsSection";
import AlatiSection from "./alati/AlatiSection";

export default function Settings() {
  const [name, setName] = useState("");
  const [open, setOpen] = useState("nalog");
  const [section, setSection] = useState("meni");

  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));

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
