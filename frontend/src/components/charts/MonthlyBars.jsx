import { formatMoney, formatMonth, shortMonth } from '../../utils/format';

const WIDTH = 520;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 8 };

// Barras lado a lado (receita x despesa) por mês, em SVG puro.
export default function MonthlyBars({ data }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.income, item.expense]));
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = (WIDTH - PAD.left - PAD.right) / data.length;
  const barWidth = Math.min(26, slot / 3);
  const height = (value) => (value / max) * innerHeight;
  const baseline = PAD.top + innerHeight;

  return (
    <div className="bars">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Receitas e despesas dos últimos meses">
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <line key={step} x1={PAD.left} x2={WIDTH - PAD.right} y1={baseline - innerHeight * step} y2={baseline - innerHeight * step} className="grid-line" />
        ))}
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={baseline} y2={baseline} className="axis-line" />
        {data.map((item, index) => {
          const center = PAD.left + slot * index + slot / 2;
          return (
            <g key={item.month}>
              <rect x={center - barWidth - 2} y={baseline - height(item.income)} width={barWidth} height={height(item.income)} rx="3" className="bar-income">
                <title>{`Receitas em ${formatMonth(item.month)}: ${formatMoney(item.income)}`}</title>
              </rect>
              <rect x={center + 2} y={baseline - height(item.expense)} width={barWidth} height={height(item.expense)} rx="3" className="bar-expense">
                <title>{`Despesas em ${formatMonth(item.month)}: ${formatMoney(item.expense)}`}</title>
              </rect>
              <text x={center} y={HEIGHT - 6} className="bar-label">
                {shortMonth(item.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="bars-legend">
        <span><i className="dot-income" /> Receitas</span>
        <span><i className="dot-expense" /> Despesas</span>
      </p>
    </div>
  );
}
