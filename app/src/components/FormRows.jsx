import { useState } from "react";
import { ChevronDownIcon } from "../icons";

export function ToggleRow({ label, desc, defaultChecked }) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-label">{label}</p>
        <p className="settings-row-desc">{desc}</p>
      </div>
      <input
        className="toggle"
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
    </div>
  );
}

export function InputRow({ label, desc, type, defaultValue }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-label">{label}</p>
        <p className="settings-row-desc">{desc}</p>
      </div>
      <input
        className="settings-input"
        type={type || "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
