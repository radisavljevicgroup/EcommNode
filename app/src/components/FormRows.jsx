import { useState } from "react";
import { ChevronDownIcon } from "../icons";

export function ToggleRow({ label, desc, defaultChecked, soon }) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-label">
          {label}
          {soon && <span className="soon-badge">Uskoro dostupno</span>}
        </p>
        <p className="settings-row-desc">{desc}</p>
      </div>
      <input
        className="toggle"
        type="checkbox"
        checked={soon ? false : checked}
        onChange={soon ? undefined : (e) => setChecked(e.target.checked)}
        disabled={soon}
        readOnly={soon}
      />
    </div>
  );
}

export function InputRow({ label, desc, type, value, onChange, readOnly }) {
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-label">{label}</p>
        <p className="settings-row-desc">{desc}</p>
      </div>
      <input
        className="settings-input"
        type={type || "text"}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        disabled={readOnly}
      />
    </div>
  );
}

export function AccordionRow({
  id,
  icon: Icon,
  label,
  open,
  onToggle,
  danger,
  children,
}) {
  return (
    <>
      <button
        type="button"
        className={"menu-row" + (danger ? " danger" : "")}
        onClick={() => onToggle(id)}
      >
        <Icon />
        <span>{label}</span>
        {children && (
          <span className={"menu-row-caret" + (open ? " open" : "")}>
            <ChevronDownIcon />
          </span>
        )}
      </button>
      {children && open && <div className="menu-section-body">{children}</div>}
    </>
  );
}
