import { useState } from "react";
import MiniMonth from "./MiniMonth";
import { PlusIcon, CheckIcon, CloseIcon, PencilIcon } from "../../icons";
import { CALENDAR_COLORS, DEFAULT_CALENDAR_COLOR } from "../../constants/calendarColors";

function ColorPicker({ value, onChange }) {
  return (
    <div className="cal-color-picker">
      {CALENDAR_COLORS.map((c) => (
        <button
          type="button"
          key={c.id}
          className={"cal-color-swatch cal-color-" + c.id + (value === c.id ? " selected" : "")}
          title={c.label}
          aria-label={c.label}
          onClick={() => onChange(c.id)}
        >
          {value === c.id && <CheckIcon />}
        </button>
      ))}
    </div>
  );
}

function CategoryForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || DEFAULT_CALENDAR_COLOR);

  return (
    <form
      className="cal-category-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), color });
      }}
    >
      <input
        type="text"
        placeholder="Naziv kalendara"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="cal-category-form-actions">
        <button type="button" className="cal-category-form-cancel" onClick={onCancel}>
          Otkaži
        </button>
        <button type="submit" className="cal-category-form-save">
          Sačuvaj
        </button>
      </div>
    </form>
  );
}

export default function CalendarSidebar({
  monthDate,
  selectedDate,
  onSelectDate,
  onChangeMonth,
  categories,
  hiddenCategoryIds,
  onToggleCategory,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  categoryError,
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  return (
    <aside className="cal-sidebar">
      <MiniMonth
        monthDate={monthDate}
        selectedDate={selectedDate}
        onSelectDate={onSelectDate}
        onChangeMonth={onChangeMonth}
      />

      <div className="cal-sidebar-section">
        <p className="cal-sidebar-title">Kalendari</p>

        <div className="cal-list">
          {categories.map((c) =>
            editingId === c.id ? (
              <CategoryForm
                key={c.id}
                initial={c}
                onCancel={() => setEditingId(null)}
                onSave={(patch) => {
                  onUpdateCategory(c.id, patch);
                  setEditingId(null);
                }}
              />
            ) : (
              <div className="cal-list-item" key={c.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!hiddenCategoryIds.has(c.id)}
                    onChange={() => onToggleCategory(c.id)}
                  />
                  <span className={"cal-list-dot cal-color-" + c.color} />
                  <span className="cal-list-name">{c.name}</span>
                </label>
                <div className="cal-list-item-actions">
                  <button
                    type="button"
                    onClick={() => setEditingId(c.id)}
                    aria-label={`Izmeni ${c.name}`}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCategory(c.id)}
                    aria-label={`Obriši ${c.name}`}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {categoryError && <p className="cal-category-error">{categoryError}</p>}

        {adding ? (
          <CategoryForm
            onCancel={() => setAdding(false)}
            onSave={(payload) => {
              onAddCategory(payload);
              setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="cal-add-category" onClick={() => setAdding(true)}>
            <PlusIcon />
            Dodaj kalendar
          </button>
        )}
      </div>
    </aside>
  );
}
