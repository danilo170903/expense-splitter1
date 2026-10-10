import { describe, it, expect } from 'vitest'
import { parseAmountToCents, formatCents, splitCents } from './money.js'

describe('parseAmountToCents', () => {
  it.each([
    ['90', 9000],
    ['90,00', 9000],
    ['90.00', 9000],
    ['90,5', 9050],
    ['33,34', 3334],
    ['0', 0],
    [' 12,30 ', 1230],
  ])('parses "%s" as %i cents', (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents)
  })

  it.each(['', '   ', '-5', '12,345', 'abc', '1,2,3', '1.000,00', '90,', ',5'])(
    'rejects "%s"',
    (input) => {
      expect(() => parseAmountToCents(input)).toThrow('Neispravan iznos')
    },
  )

  it.each([null, undefined, 90])('rejects non-string %p', (input) => {
    expect(() => parseAmountToCents(input)).toThrow('Neispravan iznos')
  })
})

describe('formatCents', () => {
  it.each([
    [9000, '90,00 €'],
    [3334, '33,34 €'],
    [0, '0,00 €'],
  ])('formats %i as "%s"', (cents, text) => {
    expect(formatCents(cents)).toBe(text)
  })
})

describe('splitCents', () => {
  it('gives the remainder cents to the first elements', () => {
    expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333])
  })

  it('always sums exactly to the amount', () => {
    for (const [amount, count] of [[1, 3], [100, 7], [9999, 4], [0, 5]]) {
      const shares = splitCents(amount, count)
      expect(shares).toHaveLength(count)
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(amount)
    }
  })

  it('throws when count is less than 1', () => {
    expect(() => splitCents(100, 0)).toThrow()
  })

  it('throws when amount is not a non-negative integer', () => {
    expect(() => splitCents(-1, 2)).toThrow()
    expect(() => splitCents(10.5, 2)).toThrow()
  })
})
