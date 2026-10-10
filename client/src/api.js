export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message) {
    super(message, 401)
    this.name = 'UnauthorizedError'
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return null

  const data = await response.json().catch(() => null)
  if (response.ok) return data

  const message = data?.error || 'Greška na serveru'
  if (response.status === 401) throw new UnauthorizedError(message)
  throw new ApiError(message, response.status)
}

export const getMe = () => request('/me')

export const login = (username, password) =>
  request('/login', { method: 'POST', body: { username, password } })

export async function logout() {
  await request('/logout', { method: 'POST' })
}

export const listGroups = () => request('/groups')

export const createGroup = (name) => request('/groups', { method: 'POST', body: { name } })

export const getGroup = (id) => request(`/groups/${encodeURIComponent(id)}`)

export const addMember = (groupId, name) =>
  request(`/groups/${encodeURIComponent(groupId)}/members`, { method: 'POST', body: { name } })

export const addExpense = (groupId, { title, amount, payer, participants }) =>
  request(`/groups/${encodeURIComponent(groupId)}/expenses`, {
    method: 'POST',
    body: { title, amount, payer, participants },
  })

export const deleteExpense = (groupId, expenseId) =>
  request(`/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'DELETE',
  })

export const markPaid = (groupId, { from, to, amountCents }) =>
  request(`/groups/${encodeURIComponent(groupId)}/payments`, {
    method: 'POST',
    body: { from, to, amountCents },
  })

export const unmarkPaid = (groupId, paymentId) =>
  request(`/groups/${encodeURIComponent(groupId)}/payments/${encodeURIComponent(paymentId)}`, {
    method: 'DELETE',
  })
