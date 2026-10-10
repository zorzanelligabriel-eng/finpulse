const { HttpError } = require('../utils/httpError');

// Valida req.body / req.query / req.params com um schema do zod.
// O resultado já convertido (números, datas...) fica em req.valid[source].
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new HttpError(400, details[0].message, details));
    }
    req.valid = { ...req.valid, [source]: result.data };
    next();
  };
}

module.exports = { validate };
