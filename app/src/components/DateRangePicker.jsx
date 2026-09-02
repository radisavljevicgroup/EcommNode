import { useState } from "react";

// toISOString() converts to UTC first — with a local timezone ahead of
// UTC (e.g. Serbia), local midnight on the 1st becomes the previous day,
// shifting every preset's boundary back by a day. Build the string from
// local date parts instead.
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d;
}

function endOfMonth(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return d;
}

function startOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

export const PRESETS = [
  { key: "7d", label: "Zadnjih 7 dana", range: () => [isoDate(daysAgo(7)), isoDate(new Date())] },
  { key: "month", label: "Ovaj mesec", range: () => [isoDate(startOfMonth()), isoDate(new Date())] },
  {
    key: "last-month",
    label: "Prošli mesec",
    range: () => [isoDate(startOfMonth(-1)), isoDate(endOfMonth(-1))],
  },
  { key: "year", label: "Ova godina", range: () => [isoDate(startOfYear()), isoDate(new Date())] },
];

export default function DateRangePicker({ from, to, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("year");

  const handlePresetClick = (p) => {
    const [f, t] = p.range();
    onChange(f, t);
    setSelectedPreset(p.key);
    setCustomOpen(false);
  };

  const handleCustomToggle = () => {
    setCustomOpen((v) => !v);
    setSelectedPreset(null);
  };

  const handleCustomInput = (f, t) => {
    onChange(f, t);
    setSelectedPreset(null);
  };

  return (
    <div className="date-range-picker">
      <div className="date-range-presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={"date-range-preset" + (selectedPreset === p.key ? " active" : "")}
            onClick={() => handlePresetClick(p)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={"date-range-preset" + (customOpen ? " active" : "")}
          onClick={handleCustomToggle}
        >
          Prilagođeno
        </button>
      </div>
      {customOpen && (
        <div className="date-range-custom">
          <input
            type="date"
            value={from}
            onChange={(e) => handleCustomInput(e.target.value, to)}
          />
          <span>—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => handleCustomInput(from, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
