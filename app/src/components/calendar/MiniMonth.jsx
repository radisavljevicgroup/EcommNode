import { ChevronLeftIcon, ChevronRightIcon } from "../../icons";
import { buildMonthGrid, formatMonthYear, isSameDay, isToday } from "../../utils/calendarDate";

const WEEKDAY_MINI_SR = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];

export default function MiniMonth({ monthDate, selectedDate, onSelectDate, onChangeMonth }) {
  const days = buildMonthGrid(monthDate);

  return (
    <div className="cal-mini">
      <div className="cal-mini-head">
        <span>{formatMonthYear(monthDate)}</span>
        <div className="cal-mini-nav">
          <button type="button" onClick={() => onChangeMonth(-1)} aria-label="Prethodni mesec">
            <ChevronLeftIcon />
          </button>
          <button type="button" onClick={() => onChangeMonth(1)} aria-label="Sledeći mesec">
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="cal-mini-grid cal-mini-weekdays">
        {WEEKDAY_MINI_SR.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="cal-mini-grid">
        {days.map((day) => {
          const outside = day.getMonth() !== monthDate.getMonth();
          return (
            <button
              type="button"
              key={day.toISOString()}
              className={
                "cal-mini-day" +
                (outside ? " outside" : "") +
                (isToday(day) ? " today" : "") +
                (isSameDay(day, selectedDate) ? " selected" : "")
              }
              onClick={() => onSelectDate(day)}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
