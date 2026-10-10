import { describe, it, expect } from 'vitest'
import { computeSettlement } from './settlement.js'

describe('computeSettlement', () => {
  it('S3 - Ručak i taksi', () => {
    const members = ['Ana', 'Marko', 'Iva']
    const all = ['Ana', 'Marko', 'Iva']
    const result = computeSettlement(
      [
        { payer: 'Ana', amountCents: 9000, participants: all },
        { payer: 'Marko', amountCents: 3000, participants: all },
      ],
      members,
    )

    expect(result.transfers).toEqual([
      { from: 'Iva', to: 'Ana', amountCents: 4000 },
      { from: 'Marko', to: 'Ana', amountCents: 1000 },
    ])
    expect(result.balances).toEqual([
      { name: 'Ana', netCents: 5000 },
      { name: 'Marko', netCents: -1000 },
      { name: 'Iva', netCents: -4000 },
    ])
  })

  it('S4 - Zaokruživanje', () => {
    const all = ['Ana', 'Marko', 'Iva']
    const result = computeSettlement(
      [{ payer: 'Ana', amountCents: 10000, participants: all }],
      all,
    )

    expect(result.transfers).toEqual([
      { from: 'Marko', to: 'Ana', amountCents: 3333 },
      { from: 'Iva', to: 'Ana', amountCents: 3333 },
    ])
  })

  it('S6 - Nema dugovanja', () => {
    const result = computeSettlement(
      [{ payer: 'Ana', amountCents: 5000, participants: ['Ana'] }],
      ['Ana'],
    )

    expect(result.transfers).toEqual([])
    expect(result.balances).toEqual([{ name: 'Ana', netCents: 0 }])
  })

  it('two expenses with the same amount paid by different people cancel out', () => {
    const all = ['Ana', 'Marko']
    const result = computeSettlement(
      [
        { payer: 'Ana', amountCents: 6000, participants: all },
        { payer: 'Marko', amountCents: 6000, participants: all },
      ],
      all,
    )

    expect(result.transfers).toEqual([])
    expect(result.balances).toEqual([
      { name: 'Ana', netCents: 0 },
      { name: 'Marko', netCents: 0 },
    ])
  })

  it('returns no transfers and zero balances without expenses', () => {
    const result = computeSettlement([], ['Ana', 'Marko'])

    expect(result.transfers).toEqual([])
    expect(result.balances).toEqual([
      { name: 'Ana', netCents: 0 },
      { name: 'Marko', netCents: 0 },
    ])
  })

  it('returns empty results for no members', () => {
    expect(computeSettlement([], [])).toEqual({ balances: [], transfers: [] })
  })

  it('does not mutate its inputs', () => {
    const expenses = [{ payer: 'Ana', amountCents: 9000, participants: ['Ana', 'Marko', 'Iva'] }]
    const members = ['Ana', 'Marko', 'Iva']
    const expensesCopy = structuredClone(expenses)
    const membersCopy = [...members]

    computeSettlement(expenses, members)

    expect(expenses).toEqual(expensesCopy)
    expect(members).toEqual(membersCopy)
  })

  describe('payments', () => {
    const members = ['Ana', 'Marko', 'Iva']
    const lunchAndTaxi = [
      { payer: 'Ana', amountCents: 9000, participants: members },
      { payer: 'Marko', amountCents: 3000, participants: members },
    ]

    it('S8 - plaćen dug Iva -> Ana nestaje iz dugovanja', () => {
      const result = computeSettlement(lunchAndTaxi, members, [
        { from: 'Iva', to: 'Ana', amountCents: 4000 },
      ])

      expect(result.transfers).toEqual([{ from: 'Marko', to: 'Ana', amountCents: 1000 }])
      expect(result.balances).toEqual([
        { name: 'Ana', netCents: 1000 },
        { name: 'Marko', netCents: -1000 },
        { name: 'Iva', netCents: 0 },
      ])
    })

    it('a payment moves the net of both sides', () => {
      const result = computeSettlement([], ['Ana', 'Marko'], [
        { from: 'Marko', to: 'Ana', amountCents: 500 },
      ])

      expect(result.balances).toEqual([
        { name: 'Ana', netCents: -500 },
        { name: 'Marko', netCents: 500 },
      ])
      expect(result.transfers).toEqual([{ from: 'Ana', to: 'Marko', amountCents: 500 }])
    })

    it('an overpayment flips the debt and never yields a transfer with amountCents <= 0', () => {
      const result = computeSettlement([], ['Ana', 'Marko'], [
        { from: 'Marko', to: 'Ana', amountCents: 700 },
      ])

      expect(result.transfers).toEqual([{ from: 'Ana', to: 'Marko', amountCents: 700 }])
      expect(result.transfers.every((t) => t.amountCents > 0)).toBe(true)
    })

    it('does not mutate the payments array', () => {
      const payments = [{ from: 'Iva', to: 'Ana', amountCents: 4000 }]
      const copy = structuredClone(payments)

      computeSettlement(lunchAndTaxi, members, payments)

      expect(payments).toEqual(copy)
    })
  })
})
