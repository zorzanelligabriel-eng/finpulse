import { formatMoney } from '../../utils/format';

const SIZE = 180;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Gráfico de rosca em SVG puro: cada fatia é um círculo com traço parcial (stroke-dasharray).
export default function Donut({ slices, centerLabel }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${centerLabel}: ${formatMoney(total)}`}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {slices.map((slice) => {
            const length = (slice.value / total) * CIRCUMFERENCE;
            const circle = (
              <circle
                key={slice.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
                // 1px de folga entre fatias
                strokeDasharray={`${Math.max(length - 1.5, 0.5)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-offset}
              >
                <title>{`${slice.label}: ${formatMoney(slice.value)}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
        </g>
        <text x="50%" y="47%" className="donut-caption">
          {centerLabel}
        </text>
        <text x="50%" y="60%" className="donut-total">
          {formatMoney(total)}
        </text>
      </svg>
      <ul className="legend">
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} />
            <span>{slice.label}</span>
            <b>{formatMoney(slice.value)}</b>
            <small>{Math.round((slice.value / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
