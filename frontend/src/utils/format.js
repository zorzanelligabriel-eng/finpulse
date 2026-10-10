const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatMoney = (value) => brl.format(value ?? 0);

// Preços muito pequenos (ex.: R$ 0,0041) precisam de mais casas para não virar "R$ 0,00".
export function formatPrice(value) {
  if (value == null) return '—';
  if (value >= 1) return brl.format(value);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumSignificantDigits: 4 }).format(value);
}

export function formatPercent(value) {
  if (value == null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export const formatQuantity = (value) => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 8 });

// '2026-10-09' -> '09/10/2026' (sem passar por Date, para não sofrer com fuso horário)
export const formatDate = (iso) => iso.split('-').reverse().join('/');

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// '2026-10' -> 'outubro de 2026'
export function formatMonth(month) {
  const [year, number] = month.split('-').map(Number);
  return `${MONTH_NAMES[number - 1]} de ${year}`;
}

// '2026-10' -> 'out'
export const shortMonth = (month) => MONTH_NAMES[Number(month.split('-')[1]) - 1].slice(0, 3);

const pad = (n) => String(n).padStart(2, '0');

// Data/mês de hoje no fuso do navegador (toISOString usaria UTC e erraria à noite no Brasil).
export function today() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export const currentMonth = () => today().slice(0, 7);

// Soma (ou subtrai) meses de 'AAAA-MM'.
export function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export const formatTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR') : '—');

// Aceita "1.234,56" ou "1234.56" digitado pelo usuário e devolve número (ou NaN).
export function parseNumber(text) {
  const clean = String(text).trim().replace(/\s/g, '');
  if (!clean) return NaN;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  return Number(normalized);
}
