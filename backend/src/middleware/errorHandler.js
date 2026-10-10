const { HttpError } = require('../utils/httpError');

function notFound(req, res, next) {
  next(new HttpError(404, 'Rota não encontrada.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // JSON malformado no corpo da requisição
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
}

module.exports = { notFound, errorHandler };
