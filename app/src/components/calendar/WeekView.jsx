import { useRef, useState } from "react";
import {
  WEEKDAY_SHORT_SR,
  isToday,
  layoutDayEvents,
  minutesFromTime,
  timeFromMinutes,
  toISODate,
} from "../../utils/calendarDate";

const HOUR_START = 6;
const HOUR_END = 22; // exclusive upper bound of the grid
const ROW_HEIGHT = 52;
const GRID_MINUTES = (HOUR_END - HOUR_START) * 60;
const GRID_HEIGHT = (HOUR_END - HOUR_START) * ROW_HEIGHT;
const GUTTER_WIDTH = 56; // matches .cal-week-gutter's width in index.css
const DRAG_THRESHOLD = 4; // px of pointer movement before a click becomes a drag
const SNAP_MINUTES = 15;

function minutesToY(minutes) {
  return ((minutes - HOUR_START * 60) / GRID_MINUTES) * GRID_HEIGHT;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function now() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function WeekView({ days, eventsByDay, categoryMap, onSlotClick, onEventClick, onEventMove }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const nowMinutes = now();
  const showNowLine = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;

  const bodyRef = useRef(null);
  const dragRef = useRef(null);
  // A drag that actually moved the pointer fires a native click on mouseup
  // right after our handler runs — this suppresses that one click so it
  // doesn't also open the edit modal or create a new event underneath.
  const justDraggedRef = useRef(false);
  const [dragPreview, setDragPreview] = useState(null);
  const [allDayDragPreview, setAllDayDragPreview] = useState(null);

  const handleColumnClick = (day) => (e) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const rawMinutes = HOUR_START * 60 + (offsetY / GRID_HEIGHT) * GRID_MINUTES;
    const snapped = Math.round(rawMinutes / 30) * 30;
    onSlotClick(day, timeFromMinutes(snapped));
  };

  const handleEventClick = (ev) => (e) => {
    e.stopPropagation();
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onEventClick(ev);
  };

  const startDrag = (ev, dayIndex) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const bodyRect = bodyRef.current.getBoundingClientRect();
    const columnWidth = (bodyRect.width - GUTTER_WIDTH) / days.length;
    const startMin = minutesFromTime(ev.startTime);
    const endMin = minutesFromTime(ev.endTime);
    const origTop = minutesToY(Math.max(startMin, HOUR_START * 60));
    const pixelHeight = Math.max(18, minutesToY(Math.min(endMin, HOUR_END * 60)) - origTop);
    const origLeft = GUTTER_WIDTH + dayIndex * columnWidth;

    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origDayIndex: dayIndex,
      duration: endMin - startMin,
      startMin,
      moved: false,
      columnWidth,
      origTop,
      origLeft,
      pixelHeight,
      // Kept in sync with the visual preview on every move so mouseup can
      // read the final drop target without depending on stale React state.
      resultDayIndex: dayIndex,
      resultStartMin: startMin,
    };
    // The visual preview (setDragPreview) only starts once the pointer has
    // actually moved past the threshold below — setting it immediately on
    // mousedown would re-render and hide the source block before the
    // browser's native click fires, silently breaking plain clicks.

    const handleMove = (moveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = moveEvent.clientX - drag.startClientX;
      const dy = moveEvent.clientY - drag.startClientY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.moved = true;

      // Snapped day/time — decides what actually gets saved on drop, and
      // what the little time label shows.
      const dayDelta = Math.round(dx / drag.columnWidth);
      const newDayIndex = clamp(drag.origDayIndex + dayDelta, 0, days.length - 1);

      const rawMinuteDelta = (dy / GRID_HEIGHT) * GRID_MINUTES;
      const snappedDelta = Math.round(rawMinuteDelta / SNAP_MINUTES) * SNAP_MINUTES;
      let newStart = drag.startMin + snappedDelta;
      newStart = clamp(newStart, HOUR_START * 60, HOUR_END * 60 - drag.duration);

      drag.resultDayIndex = newDayIndex;
      drag.resultStartMin = newStart;

      // Raw pixel position — the block itself tracks the cursor 1:1 with no
      // snapping, so it never visually detaches from the pointer. Only the
      // eventual drop target (above) is snapped.
      const pixelTop = clamp(drag.origTop + dy, 0, GRID_HEIGHT - drag.pixelHeight);
      const maxLeft = GUTTER_WIDTH + (days.length - 1) * drag.columnWidth;
      const pixelLeft = clamp(drag.origLeft + dx, GUTTER_WIDTH, maxLeft);

      setDragPreview({
        eventId: ev.id,
        pixelTop,
        pixelLeft,
        width: drag.columnWidth - 3,
        height: drag.pixelHeight,
        startMin: newStart,
        endMin: newStart + drag.duration,
      });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      const drag = dragRef.current;
      dragRef.current = null;
      setDragPreview(null);
      if (drag && drag.moved) {
        justDraggedRef.current = true;
        const newDay = days[drag.resultDayIndex];
        const newEnd = drag.resultStartMin + drag.duration;
        onEventMove(ev, newDay, timeFromMinutes(drag.resultStartMin), timeFromMinutes(newEnd));
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // All-day events only ever move between days — no vertical/time axis.
  const startAllDayDrag = (ev, dayIndex) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const bodyRect = bodyRef.current.getBoundingClientRect();
    const columnWidth = (bodyRect.width - GUTTER_WIDTH) / days.length;

    const drag = { startClientX: e.clientX, origDayIndex: dayIndex, moved: false, resultDayIndex: dayIndex };

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - drag.startClientX;
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.moved = true;
      const dayDelta = Math.round(dx / columnWidth);
      const newDayIndex = clamp(drag.origDayIndex + dayDelta, 0, days.length - 1);
      drag.resultDayIndex = newDayIndex;
      setAllDayDragPreview({ eventId: ev.id, dayIndex: newDayIndex });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      setAllDayDragPreview(null);
      if (drag.moved) {
        justDraggedRef.current = true;
        onEventMove(ev, days[drag.resultDayIndex], null, null);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  return (
    <div className="cal-week">
      <div className="cal-week-header">
        <div className="cal-week-gutter" />
        {days.map((day, i) => (
          <div key={day.toISOString()} className="cal-week-day-head">
            <span className="cal-week-day-name">{WEEKDAY_SHORT_SR[i]}</span>
            <span className={"cal-week-day-num" + (isToday(day) ? " today" : "")}>
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      <div className="cal-week-allday">
        <div className="cal-week-gutter" />
        {days.map((day, dayIndex) => {
          const dayEvents = (eventsByDay[toISODate(day)] || []).filter(
            (e) => e.allDay && allDayDragPreview?.eventId !== e.id
          );
          const isDropTarget = allDayDragPreview?.dayIndex === dayIndex;
          return (
            <div
              key={day.toISOString()}
              className={"cal-week-allday-cell" + (isDropTarget ? " drop-target" : "")}
              onClick={() => onSlotClick(day, null)}
            >
              {dayEvents.map((ev) => {
                const category = categoryMap[ev.categoryId];
                return (
                  <button
                    type="button"
                    key={ev.id}
                    className={"cal-event-chip cal-color-" + (category?.color || "gray")}
                    onMouseDown={startAllDayDrag(ev, dayIndex)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (justDraggedRef.current) {
                        justDraggedRef.current = false;
                        return;
                      }
                      onEventClick(ev);
                    }}
                  >
                    {ev.title}
                  </button>
                );
              })}
              {isDropTarget && (
                <span className="cal-event-chip cal-event-chip-ghost">
                  {Object.values(eventsByDay)
                    .flat()
                    .find((e) => e.id === allDayDragPreview.eventId)?.title}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="cal-week-body" ref={bodyRef}>
        <div className="cal-week-gutter cal-week-hours">
          {hours.map((h) => (
            <div key={h} className="cal-week-hour-label" style={{ height: ROW_HEIGHT }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => {
          const timed = layoutDayEvents(
            (eventsByDay[toISODate(day)] || []).filter(
              (e) => !e.allDay && dragPreview?.eventId !== e.id
            )
          );
          return (
            <div
              key={day.toISOString()}
              className="cal-week-day-col"
              style={{ height: GRID_HEIGHT }}
              onClick={handleColumnClick(day)}
            >
              {hours.map((h) => (
                <div key={h} className="cal-week-hour-line" style={{ height: ROW_HEIGHT }} />
              ))}

              {isToday(day) && showNowLine && (
                <div className="cal-week-now-line" style={{ top: minutesToY(nowMinutes) }} />
              )}

              {timed.map((ev) => {
                const category = categoryMap[ev.categoryId];
                const start = minutesFromTime(ev.startTime);
                const end = minutesFromTime(ev.endTime);
                const top = minutesToY(Math.max(start, HOUR_START * 60));
                const height = Math.max(18, minutesToY(Math.min(end, HOUR_END * 60)) - top);
                const widthPct = 100 / ev.columnCount;
                return (
                  <button
                    type="button"
                    key={ev.id}
                    className={"cal-event-block cal-color-" + (category?.color || "gray")}
                    style={{
                      top,
                      height,
                      left: `${ev.column * widthPct}%`,
                      width: `calc(${widthPct}% - 3px)`,
                    }}
                    onMouseDown={startDrag(ev, dayIndex)}
                    onClick={handleEventClick(ev)}
                  >
                    <span className="cal-event-block-title">{ev.title}</span>
                    <span className="cal-event-block-time">
                      {ev.startTime}–{ev.endTime}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}

        {dragPreview &&
          (() => {
            const rawEvent = Object.values(eventsByDay)
              .flat()
              .find((e) => e.id === dragPreview.eventId);
            if (!rawEvent) return null;
            const category = categoryMap[rawEvent.categoryId];
            return (
              <div
                className={"cal-event-block cal-event-block-ghost cal-color-" + (category?.color || "gray")}
                style={{
                  top: dragPreview.pixelTop,
                  height: dragPreview.height,
                  left: dragPreview.pixelLeft,
                  width: dragPreview.width,
                }}
              >
                <span className="cal-event-block-title">{rawEvent.title}</span>
                <span className="cal-event-block-time">
                  {timeFromMinutes(dragPreview.startMin)}–{timeFromMinutes(dragPreview.endMin)}
                </span>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
