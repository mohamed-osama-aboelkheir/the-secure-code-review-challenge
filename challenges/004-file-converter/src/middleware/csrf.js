const crypto = require('crypto');

/**
 * Per-session CSRF tokens for the server-rendered UI.
 *
 * The JSON API is exercised by scripts and CLI clients that do not carry a
 * rendered form, so token checks are applied to the browser-facing routes in
 * src/routes/ui.js only. The session cookie is SameSite=Lax either way.
 */

const TOKEN_BYTES = 32;

function issueToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Makes the current session's token available to every template as
 * `csrfToken`, minting one on first use.
 */
function attachCsrfToken(req, res, next) {
  if (!req.session) {
    return next(new Error('Session middleware must run before attachCsrfToken'));
  }
  res.locals.csrfToken = issueToken(req);
  res.locals.user = null;
  next();
}

function tokensMatch(submitted, expected) {
  if (typeof submitted !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const a = Buffer.from(submitted, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

/**
 * True when the request carries the `_csrf` field matching this session's
 * token. Must be called after the body has been parsed.
 */
function hasValidCsrfToken(req) {
  const expected = req.session && req.session.csrfToken;
  const submitted = req.body && req.body._csrf;
  return Boolean(expected) && tokensMatch(submitted, expected);
}

/**
 * Rejects state-changing form posts whose `_csrf` field does not match the
 * token held in the session. Must run after the body has been parsed.
 */
function verifyCsrf(req, res, next) {
  if (!hasValidCsrfToken(req)) {
    return res.status(403).render('error', {
      title: 'Request rejected',
      message: 'Your session has expired or the form was not submitted from this site. Please go back and try again.'
    });
  }
  next();
}

module.exports = {
  attachCsrfToken,
  hasValidCsrfToken,
  verifyCsrf
};
