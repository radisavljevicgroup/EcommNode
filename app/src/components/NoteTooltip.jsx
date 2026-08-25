import { useEffect, useRef, useState } from "react";
import { NoteIcon } from "../icons";

// Shown on an order's row only when it actually has a customer note —
// callers should skip rendering this component entirely when there's none.
export default function NoteTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // The order card clips overflow (rounded corners), so an absolutely
    // positioned popover would get cut off. Fixed positioning computed from
    // the trigger's real screen position escapes that clip entirely.
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 });

    const onClickAway = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  return (
    <span
      className="note-tooltip"
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="note-tooltip-trigger"
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Napomena kupca"
      >
        <NoteIcon />
      </button>
      {open && coords && (
        <div
          className="note-tooltip-popover"
          style={{ top: coords.top, left: coords.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="note-tooltip-title">Napomena kupca</p>
          <p className="note-tooltip-text">{text}</p>
        </div>
      )}
    </span>
  );
}
