// Erro com status HTTP. As rotas lançam; o errorHandler transforma em resposta JSON.
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Express 4 não captura erros de funções async sozinho; este wrapper repassa para o next().
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, asyncHandler };
