export function formatCents(cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}${euros},${rest} €`
}

export function formatTransfer(transfer) {
  return {
    title: `${transfer.from} → ${transfer.to}`,
    amount: formatCents(transfer.amountCents),
  }
}

export function formatDate(iso) {
  const date = new Date(iso)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}

function joinNames(names) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]}`
}

export function formatParticipants(participants, members) {
  const everyoneParticipated = members.every((member) => participants.includes(member))
  if (everyoneParticipated) return `podijeljeno na ${participants.length}`
  return `za ${joinNames(participants)}`
}
