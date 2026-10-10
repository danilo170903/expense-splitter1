import { randomUUID } from 'node:crypto'
import express from 'express'
import session from 'express-session'
import { checkCredentials, requireAuth } from './auth.js'
import { AppError } from './errors.js'
import { parseAmountToCents } from './money.js'
import { computeSettlement } from './settlement.js'
import { loadDb, updateDb } from './store.js'

const MAX_GROUP_NAME_LENGTH = 40
const MAX_MEMBER_NAME_LENGTH = 40
const MAX_EXPENSE_TITLE_LENGTH = 60
const INVALID_AMOUNT_MESSAGE = 'Neispravan iznos'
const NO_PARTICIPANTS_MESSAGE = 'Izaberite bar jednog učesnika'
const INVALID_PAYMENT_MESSAGE = 'Neispravno plaćanje'
const DEBT_NOT_OPEN_MESSAGE = 'Ovaj dug više nije otvoren. Osvježite stranicu.'

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isWithinLength(text, maxLength) {
  return text.length > 0 && [...text].length <= maxLength
}

function sameName(a, b) {
  return a.toLowerCase() === b.toLowerCase()
}

function findGroup(db, id) {
  const group = db.groups.find((candidate) => candidate.id === id)
  if (!group) throw new AppError(404, 'Grupa nije pronađena')
  return group
}

function toGroupDetail(group) {
  return {
    id: group.id,
    name: group.name,
    members: group.members,
    expenses: group.expenses.map(({ id, title, amountCents, payer, participants, createdAt }) => ({
      id,
      title,
      amountCents,
      payer,
      participants,
      createdAt,
    })),
    payments: group.payments.map(({ id, from, to, amountCents, createdAt }) => ({
      id,
      from,
      to,
      amountCents,
      createdAt,
    })),
    settlement: computeSettlement(group.expenses, group.members, group.payments),
  }
}

// Returns the chosen participants in group member order, or throws if the selection is invalid.
function selectParticipants(members, chosen) {
  const valid =
    Array.isArray(chosen) &&
    chosen.length > 0 &&
    new Set(chosen).size === chosen.length &&
    chosen.every((name) => members.includes(name))
  if (!valid) throw new AppError(400, NO_PARTICIPANTS_MESSAGE)
  return members.filter((name) => chosen.includes(name))
}

function safeParseAmount(value) {
  try {
    return parseAmountToCents(value)
  } catch {
    return null
  }
}

function parseAmount(value) {
  const amountCents = typeof value === 'string' ? safeParseAmount(value) : null
  if (!(amountCents > 0)) throw new AppError(400, INVALID_AMOUNT_MESSAGE)
  return amountCents
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()))
  })
}

export function createApp() {
  const app = express()

  app.use(express.json())
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  )

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body ?? {}
    if (!checkCredentials(username, password)) {
      throw new AppError(401, 'Pogrešno korisničko ime ili lozinka')
    }
    req.session.username = username
    res.json({ username })
  })

  app.post('/api/logout', requireAuth, async (req, res) => {
    await destroySession(req)
    res.sendStatus(204)
  })

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ username: req.session.username })
  })

  app.get('/api/groups', requireAuth, async (req, res) => {
    const db = await loadDb()
    res.json(db.groups.map(({ id, name }) => ({ id, name })))
  })

  app.post('/api/groups', requireAuth, async (req, res) => {
    const name = cleanText(req.body?.name)
    if (!isWithinLength(name, MAX_GROUP_NAME_LENGTH)) {
      throw new AppError(400, 'Naziv grupe je obavezan (najviše 40 znakova)')
    }
    const detail = await updateDb((db) => {
      const group = { id: randomUUID(), name, members: [], expenses: [], payments: [] }
      db.groups.push(group)
      return toGroupDetail(group)
    })
    res.status(201).json(detail)
  })

  app.get('/api/groups/:id', requireAuth, async (req, res) => {
    const db = await loadDb()
    res.json(toGroupDetail(findGroup(db, req.params.id)))
  })

  app.post('/api/groups/:id/members', requireAuth, async (req, res) => {
    const name = cleanText(req.body?.name)
    if (!isWithinLength(name, MAX_MEMBER_NAME_LENGTH)) {
      throw new AppError(400, 'Ime učesnika je obavezno (najviše 40 znakova)')
    }
    const detail = await updateDb((db) => {
      const group = findGroup(db, req.params.id)
      if (group.members.some((member) => sameName(member, name))) {
        throw new AppError(409, 'Učesnik već postoji')
      }
      group.members.push(name)
      return toGroupDetail(group)
    })
    res.status(201).json(detail)
  })

  app.post('/api/groups/:id/expenses', requireAuth, async (req, res) => {
    const { title, amount, payer, participants } = req.body ?? {}
    const cleanTitle = cleanText(title)
    if (!isWithinLength(cleanTitle, MAX_EXPENSE_TITLE_LENGTH)) {
      throw new AppError(400, 'Naziv troška je obavezan (najviše 60 znakova)')
    }
    const amountCents = parseAmount(amount)
    const detail = await updateDb((db) => {
      const group = findGroup(db, req.params.id)
      if (!group.members.includes(payer)) {
        throw new AppError(400, 'Platilac mora biti učesnik grupe')
      }
      const selected =
        participants === undefined ? [...group.members] : selectParticipants(group.members, participants)
      group.expenses.push({
        id: randomUUID(),
        title: cleanTitle,
        amountCents,
        payer,
        participants: selected,
        createdAt: new Date().toISOString(),
      })
      return toGroupDetail(group)
    })
    res.status(201).json(detail)
  })

  app.delete('/api/groups/:id/expenses/:expenseId', requireAuth, async (req, res) => {
    const detail = await updateDb((db) => {
      const group = findGroup(db, req.params.id)
      const index = group.expenses.findIndex((expense) => expense.id === req.params.expenseId)
      if (index === -1) throw new AppError(404, 'Trošak nije pronađen')
      group.expenses.splice(index, 1)
      return toGroupDetail(group)
    })
    res.json(detail)
  })

  app.post('/api/groups/:id/payments', requireAuth, async (req, res) => {
    const { from, to, amountCents } = req.body ?? {}
    const detail = await updateDb((db) => {
      const group = findGroup(db, req.params.id)
      if (!group.members.includes(from) || !group.members.includes(to) || from === to) {
        throw new AppError(400, INVALID_PAYMENT_MESSAGE)
      }
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new AppError(400, INVALID_PAYMENT_MESSAGE)
      }
      const { transfers } = computeSettlement(group.expenses, group.members, group.payments)
      const isOpen = transfers.some(
        (transfer) =>
          transfer.from === from && transfer.to === to && transfer.amountCents === amountCents,
      )
      if (!isOpen) throw new AppError(400, DEBT_NOT_OPEN_MESSAGE)
      group.payments.push({
        id: randomUUID(),
        from,
        to,
        amountCents,
        createdAt: new Date().toISOString(),
      })
      return toGroupDetail(group)
    })
    res.status(201).json(detail)
  })

  app.delete('/api/groups/:id/payments/:paymentId', requireAuth, async (req, res) => {
    const detail = await updateDb((db) => {
      const group = findGroup(db, req.params.id)
      const index = group.payments.findIndex((payment) => payment.id === req.params.paymentId)
      if (index === -1) throw new AppError(404, 'Plaćanje nije pronađeno')
      group.payments.splice(index, 1)
      return toGroupDetail(group)
    })
    res.json(detail)
  })

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta nije pronađena' })
  })

  // Express identifies error handlers by arity, so `next` must stay even though it is unused.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error instanceof AppError) {
      return res.status(error.status).json({ error: error.message })
    }
    if (error.type) {
      return res.status(error.status).json({ error: 'Neispravan zahtjev' })
    }
    console.error('Neočekivana greška:', error.stack)
    res.status(500).json({ error: 'Interna greška' })
  })

  return app
}
