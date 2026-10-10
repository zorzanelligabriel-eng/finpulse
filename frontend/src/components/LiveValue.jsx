import { useEffect, useRef, useState } from 'react';

// Mostra um número e pisca verde/vermelho quando ele sobe/desce.
export default function LiveValue({ value, format, className = '' }) {
  const previous = useRef(value);
  const [direction, setDirection] = useState('');

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before == null || value == null || before === value) return undefined;
    setDirection(value > before ? 'flash-up' : 'flash-down');
    const timer = setTimeout(() => setDirection(''), 900);
    return () => clearTimeout(timer);
  }, [value]);

  return <span className={`live-value ${direction} ${className}`}>{format(value)}</span>;
}
