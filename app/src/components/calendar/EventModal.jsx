import { useState } from "react";
import { CloseIcon } from "../../icons";

export default function EventModal({ mode, initial, categories, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(initial.title || "");
  const [date, setDate] = useState(initial.date);
  const [allDay, setAllDay] = useState(Boolean(initial.allDay));
  const [startTime, setStartTime] = useState(initial.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial.endTime || "10:00");
  const [categoryId, setCategoryId] = useState(initial.categoryId || categories[0]?.id || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Naslov je obavezan.");
      return;
    }
    if (!allDay && startTime >= endTime) {
      setError("Vreme završetka mora biti posle vremena početka.");
      return;
    }
    setError("");
    setSaving(true);
    onSave({ title: title.trim(), date, allDay, startTime, endTime, categoryId, notes })
      .catch((err) => {
        setError(err.message);
        setSaving(false);
      });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card cal-event-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Zatvori">
          <CloseIcon />
        </button>
        <p className="modal-title">{mode === "edit" ? "Izmeni događaj" : "Novi događaj"}</p>

        <form className="woo-form" onSubmit={handleSubmit}>
          <label className="woo-field">
            Naslov
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Npr. Poziv sa dobavljačem"
            />
          </label>

          <label className="woo-field">
            Datum
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="cal-allday-toggle">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
            />
            Celodnevni događaj
          </label>

          {!allDay && (
            <div className="cal-time-row">
              <label className="woo-field">
                Početak
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="woo-field">
                Kraj
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
          )}

          <div className="woo-field">
            Kalendar
            <div className="cal-category-select">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={
                    "cal-category-option cal-color-" +
                    c.color +
                    (categoryId === c.id ? " selected" : "")
                  }
                  onClick={() => setCategoryId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <label className="woo-field">
            Napomena
            <textarea
              className="woo-textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opciono"
            />
          </label>

          {error && <div className="woo-error">{error}</div>}

          <div className="cal-modal-actions">
            {mode === "edit" && (
              <button
                type="button"
                className="cal-modal-delete"
                onClick={onDelete}
                disabled={saving}
              >
                Obriši
              </button>
            )}
            <button type="submit" className="woo-submit" disabled={saving}>
              {saving ? "Čuvanje..." : "Sačuvaj"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
