const AMOUNT_PATTERN = /^(\d+)(?:[.,](\d{1,2}))?$/

export function parseAmountToCents(input) {
  if (typeof input !== 'string') {
    throw new Error('Neispravan iznos')
  }

  const match = AMOUNT_PATTERN.exec(input.trim())
  if (!match) {
    throw new Error('Neispravan iznos')
  }

  const [, euros, decimals = ''] = match
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Neispravan iznos')
  }
  return cents
}

export function formatCents(cents) {
  const euros = Math.floor(cents / 100)
  const remainder = String(cents % 100).padStart(2, '0')
  return `${euros},${remainder} €`
}

export function splitCents(amountCents, count) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error('amountCents must be a non-negative integer')
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('count must be an integer >= 1')
  }

  const base = Math.floor(amountCents / count)
  const remainder = amountCents - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}
