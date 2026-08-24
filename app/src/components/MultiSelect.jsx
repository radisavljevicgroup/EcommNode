import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../icons";

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Izaberi",
  allLabel = "Svi brendovi",
  countLabel = (n) => `${n} brend${n === 1 ? "" : "a"} izabrano`,
  emptyLabel,
  showSelectAll = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const label =
    selected.length === 0
      ? emptyLabel || placeholder
      : selected.length === options.length
      ? allLabel
      : countLabel(selected.length);

  return (
    <div className="multiselect" ref={ref}>
      <button
        type="button"
        className="multiselect-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="multiselect-menu">
          {showSelectAll && (
            <div className="multiselect-select-all">
              <button type="button" onClick={() => onChange(options.map((o) => o.id))}>
                Čekiraj sve
              </button>
              <button type="button" onClick={() => onChange([])}>
                Odčekiraj sve
              </button>
            </div>
          )}
          {options.map((opt) => (
            <label className="multiselect-option" key={opt.id}>
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={() => toggle(opt.id)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
