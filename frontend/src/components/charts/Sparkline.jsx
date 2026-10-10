// Minigráfico de linha com os últimos preços recebidos pelo WebSocket.
export default function Sparkline({ points = [], width = 96, height = 28 }) {
  if (points.length < 2) return <svg className="sparkline" width={width} height={height} aria-hidden="true" />;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((price, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(height - 2 - ((price - min) / range) * (height - 4)).toFixed(1)}`)
    .join(' ');
  const rising = points[points.length - 1] >= points[0];

  return (
    <svg className={`sparkline ${rising ? 'up' : 'down'}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
