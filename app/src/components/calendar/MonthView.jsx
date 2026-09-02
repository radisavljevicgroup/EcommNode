import { useRef, useState } from "react";
import { WEEKDAY_SHORT_SR, isToday, parseISODate, toISODate } from "../../utils/calendarDate";

const MAX_VISIBLE_PER_DAY = 3;
const DRAG_THRESHOLD = 4;

export default function MonthView({
  gridDays,
  monthDate,
  eventsByDay,
  categoryMap,
  onCellClick,
  onDayNumberClick,
  onEventClick,
  onEventMove,
}) {
  const weeks = [];
  for (let i = 0; i < gridDays.length; i += 7) weeks.push(gridDays.slice(i, i + 7));

  const dragRef = useRef(null);
  const justDraggedRef = useRef(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetDate, setDropTargetDate] = useState(null);

  const startDrag = (ev, origDate) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const drag = { origDate, resultDate: origDate, moved: false, startX: e.clientX, startY: e.clientY };
    dragRef.current = drag;
    // setDraggingId (which hides the source chip) only fires once the
    // pointer crosses the threshold below — doing it on mousedown itself
    // would re-render and remove the button before the browser's native
    // click can fire, silently breaking plain clicks.

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!drag.moved) setDraggingId(ev.id);
      drag.moved = true;

      const target = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest(".cal-month-cell");
      const date = target?.dataset.date;
      if (date) {
        drag.resultDate = date;
        setDropTargetDate(date);
      }
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      dragRef.current = null;
      setDraggingId(null);
      setDropTargetDate(null);
      if (drag.moved && drag.resultDate !== drag.origDate) {
        justDraggedRef.current = true;
        onEventMove(ev, parseISODate(drag.resultDate), null, null);
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleEventClick = (ev) => (e) => {
    e.stopPropagation();
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    onEventClick(ev);
  };

  return (
    <div className="cal-month">
      <div className="cal-month-weekdays">
        {WEEKDAY_SHORT_SR.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-month-grid">
        {weeks.map((week) =>
          week.map((day) => {
            const iso = toISODate(day);
            const outside = day.getMonth() !== monthDate.getMonth();
            const dayEvents = (eventsByDay[iso] || [])
              .filter((e) => e.id !== draggingId)
              .slice()
              .sort((a, b) => {
                if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                return (a.startTime || "").localeCompare(b.startTime || "");
              });
            const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY);
            const overflow = dayEvents.length - visible.length;

            return (
              <div
                key={day.toISOString()}
                data-date={iso}
                className={
                  "cal-month-cell" +
                  (outside ? " outside" : "") +
                  (dropTargetDate === iso ? " drop-target" : "")
                }
                onClick={() => onCellClick(day)}
              >
                <button
                  type="button"
                  className={"cal-month-day-num" + (isToday(day) ? " today" : "")}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayNumberClick(day);
                  }}
                >
                  {day.getDate()}
                </button>
                <div className="cal-month-events">
                  {visible.map((ev) => {
                    const category = categoryMap[ev.categoryId];
                    return (
                      <button
                        type="button"
                        key={ev.id}
                        className={"cal-event-chip cal-color-" + (category?.color || "gray")}
                        onMouseDown={startDrag(ev, iso)}
                        onClick={handleEventClick(ev)}
                      >
                        {!ev.allDay && <span className="cal-event-chip-time">{ev.startTime}</span>}
                        {ev.title}
                      </button>
                    );
                  })}
                  {overflow > 0 && <span className="cal-month-more">+{overflow} više</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
