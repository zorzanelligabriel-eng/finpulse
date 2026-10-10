const { z } = require('zod');

const id = z.coerce.number({ invalid_type_error: 'Identificador inválido.' }).int().positive('Identificador inválido.');

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido. Use o formato AAAA-MM.');

// Data no formato AAAA-MM-DD que exista de verdade (rejeita 2026-02-31).
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use o formato AAAA-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Data inexistente.');

const money = z.coerce
  .number({ invalid_type_error: 'Informe um valor numérico.' })
  .positive('O valor deve ser maior que zero.')
  .max(9_999_999_999.99, 'Valor alto demais.')
  // guarda só 2 casas decimais
  .transform((value) => Math.round(value * 100) / 100);

const type = z.enum(['income', 'expense'], {
  errorMap: () => ({ message: 'Tipo deve ser "income" (receita) ou "expense" (despesa).' }),
});

const idParam = z.object({ id });

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// Primeiro dia do mês e primeiro dia do mês seguinte: intervalo [início, fim) para filtrar por mês.
function monthRange(value) {
  const [year, monthNumber] = value.split('-').map(Number);
  const start = `${value}-01`;
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { start, end: next };
}

module.exports = { z, id, month, date, money, type, idParam, currentMonth, monthRange };
