const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../utils/httpError');

function signToken(user) {
  return jwt.sign({ sub: String(user.id), name: user.name }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

// Devolve o id do usuário ou lança erro se o token for inválido/expirado.
function verifyToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  return Number(payload.sub);
}

// Exige "Authorization: Bearer <token>" e coloca o id do usuário em req.userId.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Faça login para continuar.'));
  }
  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'Sessão inválida ou expirada. Faça login novamente.'));
  }
}

module.exports = { signToken, verifyToken, requireAuth };
