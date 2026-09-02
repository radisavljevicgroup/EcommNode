import { useEffect, useMemo, useState } from "react";
import CalendarSidebar from "../components/calendar/CalendarSidebar";
import WeekView from "../components/calendar/WeekView";
import MonthView from "../components/calendar/MonthView";
import EventModal from "../components/calendar/EventModal";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../icons";
import {
  fetchCalendarCategories,
  createCalendarCategory,
  updateCalendarCategory,
  deleteCalendarCategory,
  fetchCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../api/calendar";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  formatMonthYear,
  minutesFromTime,
  timeFromMinutes,
  toISODate,
} from "../utils/calendarDate";

const VIEWS = [
  { id: "week", label: "Nedelja" },
  { id: "month", label: "Mesec" },
];

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("week");
  const [categories, setCategories] = useState([]);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState(new Set());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [modalState, setModalState] = useState(null);

  useEffect(() => {
    fetchCalendarCategories()
      .then((data) => setCategories(data.categories))
      .catch((err) => setError(err.message));
  }, []);

  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate]);
  const monthGridDays = useMemo(() => buildMonthGrid(currentDate), [currentDate]);
  const visibleDays = view === "week" ? weekDays : monthGridDays;
  const rangeFrom = toISODate(visibleDays[0]);
  const rangeTo = toISODate(visibleDays[visibleDays.length - 1]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCalendarEvents(rangeFrom, rangeTo)
      .then((data) => {
        if (!cancelled) setEvents(data.events);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeFrom, rangeTo]);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

  const eventsByDay = useMemo(() => {
    const map = {};
    events
      .filter((e) => !hiddenCategoryIds.has(e.categoryId))
      .forEach((e) => {
        if (!map[e.date]) map[e.date] = [];
        map[e.date].push(e);
      });
    return map;
  }, [events, hiddenCategoryIds]);

  const toggleCategory = (id) => {
    setHiddenCategoryIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCategory = (payload) => {
    setCategoryError("");
    createCalendarCategory(payload)
      .then((data) => setCategories((cur) => [...cur, data.category]))
      .catch((err) => setCategoryError(err.message));
  };

  const updateCategory = (id, patch) => {
    setCategoryError("");
    updateCalendarCategory(id, patch)
      .then((data) =>
        setCategories((cur) => cur.map((c) => (c.id === id ? data.category : c)))
      )
      .catch((err) => setCategoryError(err.message));
  };

  const removeCategory = (id) => {
    setCategoryError("");
    deleteCalendarCategory(id)
      .then(() => setCategories((cur) => cur.filter((c) => c.id !== id)))
      .catch((err) => setCategoryError(err.message));
  };

  const changeMiniMonth = (delta) => setCurrentDate((cur) => addMonths(cur, delta));
  const goToday = () => setCurrentDate(new Date());

  const goPrevPeriod = () =>
    setCurrentDate((cur) => (view === "week" ? addDays(cur, -7) : addMonths(cur, -1)));
  const goNextPeriod = () =>
    setCurrentDate((cur) => (view === "week" ? addDays(cur, 7) : addMonths(cur, 1)));

  const jumpToWeek = (date) => {
    setCurrentDate(date);
    setView("week");
  };

  const openCreateModal = (date, time) => {
    const startTime = time || "09:00";
    setModalState({
      mode: "create",
      initial: {
        date: toISODate(date),
        allDay: time === null,
        startTime,
        endTime: timeFromMinutes(minutesFromTime(startTime) + 60),
        categoryId: categories[0]?.id,
        title: "",
        notes: "",
      },
    });
  };

  const openEditModal = (event) => setModalState({ mode: "edit", initial: event });
  const closeModal = () => setModalState(null);

  const saveEvent = (payload) => {
    const isEdit = modalState.mode === "edit";
    const request = isEdit
      ? updateCalendarEvent(modalState.initial.id, payload)
      : createCalendarEvent(payload);
    return request.then((data) => {
      const saved = data.event;
      setEvents((cur) =>
        isEdit ? cur.map((e) => (e.id === saved.id ? saved : e)) : [...cur, saved]
      );
      closeModal();
    });
  };

  const deleteEvent = () => {
    const id = modalState.initial.id;
    deleteCalendarEvent(id).then(() => {
      setEvents((cur) => cur.filter((e) => e.id !== id));
      closeModal();
    });
  };

  // Drag-and-drop move — newStartTime/newEndTime are null for an all-day
  // event (or a month-view drag, which only ever changes the date) meaning
  // "keep the event's existing time".
  const moveEvent = (event, newDate, newStartTime, newEndTime) => {
    const payload = {
      title: event.title,
      date: toISODate(newDate),
      allDay: event.allDay,
      startTime: newStartTime ?? event.startTime,
      endTime: newEndTime ?? event.endTime,
      categoryId: event.categoryId,
      notes: event.notes,
    };
    updateCalendarEvent(event.id, payload)
      .then((data) => {
        const saved = data.event;
        setEvents((cur) => cur.map((e) => (e.id === saved.id ? saved : e)));
      })
      .catch((err) => setError(err.message));
  };

  return (
    <div className="cal-page">
      <CalendarSidebar
        monthDate={currentDate}
        selectedDate={currentDate}
        onSelectDate={setCurrentDate}
        onChangeMonth={changeMiniMonth}
        categories={categories}
        hiddenCategoryIds={hiddenCategoryIds}
        onToggleCategory={toggleCategory}
        onAddCategory={addCategory}
        onUpdateCategory={updateCategory}
        onDeleteCategory={removeCategory}
        categoryError={categoryError}
      />

      <div className="cal-main">
        <div className="cal-toolbar">
          <div className="cal-toolbar-left">
            <h1 className="cal-toolbar-title">{formatMonthYear(currentDate)}</h1>
            <div className="cal-toolbar-nav">
              <button type="button" onClick={goPrevPeriod} aria-label="Prethodni period">
                <ChevronLeftIcon />
              </button>
              <button type="button" onClick={goNextPeriod} aria-label="Sledeći period">
                <ChevronRightIcon />
              </button>
            </div>
            <button type="button" className="cal-today-btn" onClick={goToday}>
              Danas
            </button>
          </div>

          <div className="cal-toolbar-right">
            <div className="cal-view-switch">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={"cal-view-btn" + (view === v.id ? " active" : "")}
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="cal-new-event-btn"
              onClick={() => openCreateModal(currentDate, "09:00")}
              disabled={categories.length === 0}
            >
              <PlusIcon />
              Novi događaj
            </button>
          </div>
        </div>

        {error && <div className="woo-error">{error}</div>}

        {view === "week" ? (
          <WeekView
            days={weekDays}
            eventsByDay={eventsByDay}
            categoryMap={categoryMap}
            onSlotClick={openCreateModal}
            onEventClick={openEditModal}
            onEventMove={moveEvent}
          />
        ) : (
          <MonthView
            gridDays={monthGridDays}
            monthDate={currentDate}
            eventsByDay={eventsByDay}
            categoryMap={categoryMap}
            onEventMove={moveEvent}
            onCellClick={(date) => openCreateModal(date, "09:00")}
            onDayNumberClick={jumpToWeek}
            onEventClick={openEditModal}
          />
        )}

        {loading && <div className="cal-loading-hint">Učitavanje…</div>}
      </div>

      {modalState && (
        <EventModal
          mode={modalState.mode}
          initial={modalState.initial}
          categories={categories}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
