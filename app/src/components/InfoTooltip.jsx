import { useEffect, useRef, useState } from "react";
import { InfoIcon } from "../icons";

export default function InfoTooltip({ text }) {
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

  return (
    <span
      className="info-tooltip"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={() => setOpen(true)}
        aria-label="Definicija metrike"
      >
        <InfoIcon />
      </button>
      {open && <div className="info-tooltip-popover">{text}</div>}
    </span>
  );
}
