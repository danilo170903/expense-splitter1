import { describe, it, expect } from 'vitest'
import { formatCents, formatTransfer } from './format.js'

describe('formatTransfer', () => {
  it('S3 - Ručak i taksi: Iva → Ana 40,00 €', () => {
    expect(formatTransfer({ from: 'Iva', to: 'Ana', amountCents: 4000 })).toEqual({
      title: 'Iva → Ana',
      amount: '40,00 €',
    })
  })

  it('S3 - Ručak i taksi: Marko → Ana 10,00 €', () => {
    expect(formatTransfer({ from: 'Marko', to: 'Ana', amountCents: 1000 })).toEqual({
      title: 'Marko → Ana',
      amount: '10,00 €',
    })
  })

  it('S4 - Zaokruživanje: Marko → Ana 33,33 €', () => {
    expect(formatTransfer({ from: 'Marko', to: 'Ana', amountCents: 3333 })).toEqual({
      title: 'Marko → Ana',
      amount: '33,33 €',
    })
  })
})

describe('formatCents', () => {
  it('formats cents with comma decimal and euro sign', () => {
    expect(formatCents(9000)).toBe('90,00 €')
    expect(formatCents(5)).toBe('0,05 €')
  })
})
