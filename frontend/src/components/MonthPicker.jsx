import { formatMonth, shiftMonth } from '../utils/format';

export default function MonthPicker({ month, onChange }) {
  return (
    <div className="month-picker">
      <button type="button" className="icon-button" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        ‹
      </button>
      <span>{formatMonth(month)}</span>
      <button type="button" className="icon-button" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Próximo mês">
        ›
      </button>
    </div>
  );
}
