import { useId, useState } from "react";
import { Calendar } from "../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../../components/ui/popover";
import { formatDateTime } from "../utils/timeFormatting";

export default function DeadlinePicker({ value, onChange, disabled }) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState();
  const [time, setTime] = useState("23:59");

  function changeOpen(nextOpen) {
    if (nextOpen) {
      setDate(value ? new Date(value) : undefined);
      setTime(value ? value.slice(11, 16) : "23:59");
    }
    setOpen(nextOpen);
  }

  function confirmDeadline() {
    if (!date || !time) return;
    const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    onChange(`${localDate}T${time}`);
    setOpen(false);
  }

  return <div className="deadline-field">
    <span id={labelId} className="instructions-field-label">Deadline</span>
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger
        type="button"
        className="deadline-picker-trigger"
        aria-labelledby={labelId}
        disabled={disabled}
      >
        <span>{value ? formatDateTime(value) : "Choose date and time"}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M7 2v6M17 2v6M3 11h18" />
        </svg>
      </PopoverTrigger>
      <PopoverContent className="deadline-picker-dialog" align="start">
        <PopoverTitle className="deadline-picker-title">Choose deadline</PopoverTitle>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={date}
          className="deadline-calendar"
        />
        <label className="deadline-picker-time">
          <span>Time</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
        </label>
        <div className="deadline-picker-actions">
          <button className="draft-text-button" type="button" onClick={() => {
            onChange("");
            setOpen(false);
          }}>Clear</button>
          <button className="draft-text-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="filled-button" type="button" disabled={!date || !time} onClick={confirmDeadline}>OK</button>
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}
