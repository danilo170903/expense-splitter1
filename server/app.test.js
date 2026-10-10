import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'

const DATA_FILE = path.join(os.tmpdir(), `expense-splitter-test-${randomUUID()}.json`)
const VALID_LOGIN = { username: 'ana', password: 'tajna-lozinka' }

let app

beforeEach(async () => {
  process.env.SESSION_SECRET = 'test-secret'
  process.env.APP_USERNAME = 'ana'
  process.env.APP_PASSWORD = 'tajna-lozinka'
  process.env.DATA_FILE = DATA_FILE
  await rm(DATA_FILE, { force: true })
  app = createApp()
})

afterAll(async () => {
  await rm(DATA_FILE, { force: true })
})

async function loggedInAgent() {
  const agent = request.agent(app)
  await agent.post('/api/login').send(VALID_LOGIN).expect(200)
  return agent
}

async function createGroup(agent, name, members) {
  const created = await agent.post('/api/groups').send({ name }).expect(201)
  let detail = created.body
  for (const member of members) {
    const response = await agent
      .post(`/api/groups/${detail.id}/members`)
      .send({ name: member })
      .expect(201)
    detail = response.body
  }
  return detail
}

async function getGroup(agent, id) {
  const response = await agent.get(`/api/groups/${id}`).expect(200)
  return response.body
}

describe('S1 - prijava', () => {
  it('prijava sa ispravnim podacima vraća korisnika', async () => {
    const agent = request.agent(app)
    const login = await agent.post('/api/login').send(VALID_LOGIN).expect(200)
    expect(login.body).toEqual({ username: 'ana' })

    const me = await agent.get('/api/me').expect(200)
    expect(me.body).toEqual({ username: 'ana' })
  })

  it('pogrešna lozinka vraća 401 i tačnu poruku', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ username: 'ana', password: 'pogresna' })
      .expect(401)
    expect(response.body).toEqual({ error: 'Pogrešno korisničko ime ili lozinka' })
  })

  it('pogrešno korisničko ime vraća istu poruku', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ username: 'marko', password: 'tajna-lozinka' })
      .expect(401)
    expect(response.body).toEqual({ error: 'Pogrešno korisničko ime ili lozinka' })
  })

  it('GET /api/groups bez prijave vraća 401', async () => {
    const response = await request(app).get('/api/groups').expect(401)
    expect(response.body).toEqual({ error: 'Potrebna je prijava' })
  })
})

describe('S2 - učesnici', () => {
  it('dodaje tri učesnika i lista čuva redoslijed unosa', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])

    const detail = await getGroup(agent, group.id)
    expect(detail.members).toEqual(['Ana', 'Marko', 'Iva'])
  })

  it('duplo ime bez obzira na velika i mala slova vraća 409', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana'])

    const response = await agent
      .post(`/api/groups/${group.id}/members`)
      .send({ name: 'ana' })
      .expect(409)
    expect(response.body).toEqual({ error: 'Učesnik već postoji' })
  })

  it.each(['', '   '])('prazno ime %j vraća 400 i ne dodaje učesnika', async (name) => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', [])

    const response = await agent
      .post(`/api/groups/${group.id}/members`)
      .send({ name })
      .expect(400)
    expect(response.body.error).toEqual(expect.any(String))

    const detail = await getGroup(agent, group.id)
    expect(detail.members).toEqual([])
  })
})

describe('S3 - ručak i taksi', () => {
  it('daje tačna dugovanja Iva -> Ana i Marko -> Ana', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])

    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Ručak', amount: '90,00', payer: 'Ana' })
      .expect(201)
    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Taksi', amount: '30,00', payer: 'Marko' })
      .expect(201)

    const detail = await getGroup(agent, group.id)
    expect(detail.settlement.transfers).toEqual([
      { from: 'Iva', to: 'Ana', amountCents: 4000 },
      { from: 'Marko', to: 'Ana', amountCents: 1000 },
    ])
  })
})

describe('S4 - zaokruživanje', () => {
  it('100,00 za troje: Marko i Iva duguju po 33,33 Ani', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])

    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Gorivo', amount: '100,00', payer: 'Ana' })
      .expect(201)

    const detail = await getGroup(agent, group.id)
    expect(detail.expenses[0].amountCents).toBe(10000)
    expect(detail.settlement.transfers).toEqual([
      { from: 'Marko', to: 'Ana', amountCents: 3333 },
      { from: 'Iva', to: 'Ana', amountCents: 3333 },
    ])
  })
})

describe('S5 - neispravan trošak', () => {
  const invalidExpenses = [
    {
      name: 'iznos sa tri decimale',
      body: { title: 'Ručak', amount: '12,345', payer: 'Ana' },
      message: 'Neispravan iznos',
    },
    {
      name: 'iznos nula',
      body: { title: 'Ručak', amount: '0', payer: 'Ana' },
      message: 'Neispravan iznos',
    },
    {
      name: 'negativan iznos',
      body: { title: 'Ručak', amount: '-5', payer: 'Ana' },
      message: 'Neispravan iznos',
    },
    {
      name: 'platilac nije učesnik',
      body: { title: 'Ručak', amount: '10,00', payer: 'Petar' },
      message: 'Platilac mora biti učesnik grupe',
    },
    {
      name: 'prazan naziv',
      body: { title: '', amount: '10,00', payer: 'Ana' },
      message: 'Naziv troška je obavezan (najviše 60 znakova)',
    },
  ]

  it.each(invalidExpenses)('$name vraća 400 i ne čuva trošak', async ({ body, message }) => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])
    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Prvi', amount: '90,00', payer: 'Ana' })
      .expect(201)

    const response = await agent.post(`/api/groups/${group.id}/expenses`).send(body).expect(400)
    expect(response.body).toEqual({ error: message })

    const detail = await getGroup(agent, group.id)
    expect(detail.expenses).toHaveLength(1)
  })
})

describe('S6 - nema dugovanja', () => {
  it('jedan učesnik koji sam plaća nema dugovanja', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Solo', ['Ana'])

    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Kafa', amount: '50,00', payer: 'Ana' })
      .expect(201)

    const detail = await getGroup(agent, group.id)
    expect(detail.settlement.transfers).toEqual([])
  })
})

describe('nepostojeća grupa', () => {
  it('GET /api/groups/:id vraća 404', async () => {
    const agent = await loggedInAgent()
    const response = await agent.get(`/api/groups/${randomUUID()}`).expect(404)
    expect(response.body).toEqual({ error: 'Grupa nije pronađena' })
  })
})

describe('S7 - podijeljen trošak', () => {
  it('trošak sa učesnicima Ana i Marko ne tereti Ivu', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])

    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Gorivo', amount: '60,00', payer: 'Ana', participants: ['Ana', 'Marko'] })
      .expect(201)

    const detail = await getGroup(agent, group.id)
    expect(detail.expenses[0].participants).toEqual(['Ana', 'Marko'])
    expect(detail.settlement.balances.find((b) => b.name === 'Iva').netCents).toBe(0)
    expect(detail.settlement.transfers).toEqual([{ from: 'Marko', to: 'Ana', amountCents: 3000 }])
  })

  it('participants prate redoslijed članova grupe, ne redoslijed u zahtjevu', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])

    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Kafa', amount: '1,00', payer: 'Ana', participants: ['Iva', 'Ana', 'Marko'] })
      .expect(201)

    const detail = await getGroup(agent, group.id)
    expect(detail.expenses[0].participants).toEqual(['Ana', 'Marko', 'Iva'])
  })

  it('prazan niz učesnika vraća 400', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko'])

    const response = await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Ručak', amount: '10,00', payer: 'Ana', participants: [] })
      .expect(400)
    expect(response.body).toEqual({ error: 'Izaberite bar jednog učesnika' })

    const detail = await getGroup(agent, group.id)
    expect(detail.expenses).toEqual([])
  })

  it('nepoznato ime u učesnicima vraća 400', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko'])

    const response = await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Ručak', amount: '10,00', payer: 'Ana', participants: ['Ana', 'Petar'] })
      .expect(400)
    expect(response.body).toEqual({ error: 'Izaberite bar jednog učesnika' })
  })

  it('duplo ime u učesnicima vraća 400', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko'])

    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Ručak', amount: '10,00', payer: 'Ana', participants: ['Ana', 'Ana'] })
      .expect(400)
  })
})

describe('S8 - označavanje duga kao plaćenog', () => {
  async function setupLunchAndTaxi() {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])
    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Ručak', amount: '90,00', payer: 'Ana' })
      .expect(201)
    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Taksi', amount: '30,00', payer: 'Marko' })
      .expect(201)
    return { agent, groupId: group.id }
  }

  it('plaćanje Iva -> Ana 40,00 uklanja to dugovanje', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const response = await agent
      .post(`/api/groups/${groupId}/payments`)
      .send({ from: 'Iva', to: 'Ana', amountCents: 4000 })
      .expect(201)
    expect(response.body.payments).toEqual([
      expect.objectContaining({ from: 'Iva', to: 'Ana', amountCents: 4000 }),
    ])
    expect(response.body.settlement.transfers).toEqual([
      { from: 'Marko', to: 'Ana', amountCents: 1000 },
    ])
  })

  it('pogrešan iznos vraća 400 i poruku o zatvorenom dugu', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const response = await agent
      .post(`/api/groups/${groupId}/payments`)
      .send({ from: 'Iva', to: 'Ana', amountCents: 3999 })
      .expect(400)
    expect(response.body).toEqual({
      error: 'Ovaj dug više nije otvoren. Osvježite stranicu.',
    })

    const detail = await getGroup(agent, groupId)
    expect(detail.payments).toEqual([])
  })

  it('plaćanje u smjeru koji nije dug vraća 400', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const response = await agent
      .post(`/api/groups/${groupId}/payments`)
      .send({ from: 'Ana', to: 'Iva', amountCents: 4000 })
      .expect(400)
    expect(response.body).toEqual({
      error: 'Ovaj dug više nije otvoren. Osvježite stranicu.',
    })
  })

  it('isti učesnik kao pošiljalac i primalac vraća 400', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const response = await agent
      .post(`/api/groups/${groupId}/payments`)
      .send({ from: 'Iva', to: 'Iva', amountCents: 4000 })
      .expect(400)
    expect(response.body).toEqual({ error: 'Neispravno plaćanje' })
  })

  it('iznos kao string vraća 400', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const response = await agent
      .post(`/api/groups/${groupId}/payments`)
      .send({ from: 'Iva', to: 'Ana', amountCents: '4000' })
      .expect(400)
    expect(response.body).toEqual({ error: 'Neispravno plaćanje' })
  })

  it('brisanje plaćanja vraća dugovanje', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const created = await agent
      .post(`/api/groups/${groupId}/payments`)
      .send({ from: 'Iva', to: 'Ana', amountCents: 4000 })
      .expect(201)
    const paymentId = created.body.payments[0].id

    const response = await agent.delete(`/api/groups/${groupId}/payments/${paymentId}`).expect(200)
    expect(response.body.payments).toEqual([])
    expect(response.body.settlement.transfers).toEqual([
      { from: 'Iva', to: 'Ana', amountCents: 4000 },
      { from: 'Marko', to: 'Ana', amountCents: 1000 },
    ])
  })

  it('brisanje nepostojećeg plaćanja vraća 404', async () => {
    const { agent, groupId } = await setupLunchAndTaxi()

    const response = await agent
      .delete(`/api/groups/${groupId}/payments/${randomUUID()}`)
      .expect(404)
    expect(response.body).toEqual({ error: 'Plaćanje nije pronađeno' })
  })
})

describe('S9 - brisanje troška', () => {
  it('brisanje troška uklanja ga i ponovo računa dugovanja', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana', 'Marko', 'Iva'])
    const lunch = await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Ručak', amount: '90,00', payer: 'Ana' })
      .expect(201)
    await agent
      .post(`/api/groups/${group.id}/expenses`)
      .send({ title: 'Taksi', amount: '30,00', payer: 'Marko' })
      .expect(201)

    const response = await agent
      .delete(`/api/groups/${group.id}/expenses/${lunch.body.expenses[0].id}`)
      .expect(200)
    expect(response.body.expenses.map((e) => e.title)).toEqual(['Taksi'])
    expect(response.body.settlement.transfers).toEqual([
      { from: 'Ana', to: 'Marko', amountCents: 1000 },
      { from: 'Iva', to: 'Marko', amountCents: 1000 },
    ])
  })

  it('brisanje nepostojećeg troška vraća 404', async () => {
    const agent = await loggedInAgent()
    const group = await createGroup(agent, 'Put', ['Ana'])

    const response = await agent
      .delete(`/api/groups/${group.id}/expenses/${randomUUID()}`)
      .expect(404)
    expect(response.body).toEqual({ error: 'Trošak nije pronađen' })
  })
})
