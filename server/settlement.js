import { splitCents } from './money.js'

export function computeSettlement(expenses, memberNames, payments = []) {
  const netByName = new Map(memberNames.map((name) => [name, 0]))

  for (const { payer, amountCents, participants } of expenses) {
    const shares = splitCents(amountCents, participants.length)
    netByName.set(payer, netByName.get(payer) + amountCents)
    participants.forEach((name, index) => {
      netByName.set(name, netByName.get(name) - shares[index])
    })
  }

  for (const { from, to, amountCents } of payments) {
    netByName.set(from, netByName.get(from) + amountCents)
    netByName.set(to, netByName.get(to) - amountCents)
  }

  const balances = memberNames.map((name) => ({ name, netCents: netByName.get(name) }))
  return { balances, transfers: buildTransfers(balances) }
}

function buildTransfers(balances) {
  const nets = balances.map(({ name, netCents }) => ({ name, netCents }))
  const transfers = []

  for (;;) {
    const creditor = pickLargest(nets, (net) => net.netCents > 0, (net) => net.netCents)
    const debtor = pickLargest(nets, (net) => net.netCents < 0, (net) => -net.netCents)
    if (!creditor || !debtor) {
      return transfers
    }

    const amountCents = Math.min(creditor.netCents, -debtor.netCents)
    transfers.push({ from: debtor.name, to: creditor.name, amountCents })
    creditor.netCents -= amountCents
    debtor.netCents += amountCents
  }
}

function pickLargest(nets, isEligible, magnitude) {
  let best = null
  for (const net of nets) {
    if (isEligible(net) && (best === null || magnitude(net) > magnitude(best))) {
      best = net
    }
  }
  return best
}
