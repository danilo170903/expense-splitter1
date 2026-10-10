import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value) {
  return createHash('sha256').update(value).digest()
}

function matches(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false
  return timingSafeEqual(digest(input), digest(expected))
}

export function checkCredentials(username, password) {
  const usernameMatches = matches(username, process.env.APP_USERNAME)
  const passwordMatches = matches(password, process.env.APP_PASSWORD)
  return usernameMatches && passwordMatches
}

export function requireAuth(req, res, next) {
  if (req.session.username) return next()
  res.status(401).json({ error: 'Potrebna je prijava' })
}
