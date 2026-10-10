import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addExpense,
  addMember,
  ApiError,
  deleteExpense,
  getGroup,
  markPaid,
  unmarkPaid,
  UnauthorizedError,
} from '../api.js'
import Card from '../components/Card.jsx'
import { useAuth } from '../auth.js'
import { formatCents, formatDate, formatParticipants, formatTransfer } from '../format.js'

export default function Group() {
  const { id } = useParams()
  const { setUser } = useAuth()
  const [group, setGroup] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(null)
  const [memberName, setMemberName] = useState('')
  const [memberError, setMemberError] = useState('')
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePayer, setExpensePayer] = useState('')
  const [excludedParticipants, setExcludedParticipants] = useState([])
  const [expenseError, setExpenseError] = useState('')
  const [expenseListError, setExpenseListError] = useState('')
  const [settlementError, setSettlementError] = useState('')

  useEffect(() => {
    let ignore = false
    setGroup(null)
    setLoadError('')
    getGroup(id)
      .then((data) => {
        if (!ignore) setGroup(data)
      })
      .catch((err) => {
        if (ignore) return
        if (err instanceof UnauthorizedError) setUser(null)
        else if (err instanceof ApiError && err.status === 404) setLoadError('Grupa nije pronađena')
        else setLoadError(err.message)
      })
    return () => {
      ignore = true
    }
  }, [id, setUser])

  if (loadError) {
    return (
      <>
        <Link className="back-link" to="/">← Sve grupe</Link>
        <p className="error" role="alert">{loadError}</p>
      </>
    )
  }

  if (!group) return <p className="muted">Učitavanje…</p>

  const members = group.members
  const hasMembers = members.length > 0
  const payer = members.includes(expensePayer) ? expensePayer : ''
  const participants = members.filter((member) => !excludedParticipants.includes(member))

  function handleFormError(err, setFormError) {
    if (err instanceof UnauthorizedError) setUser(null)
    else setFormError(err.message)
  }

  function toggleParticipant(member) {
    setExcludedParticipants((current) =>
      current.includes(member) ? current.filter((name) => name !== member) : [...current, member],
    )
  }

  async function handleAddMember(event) {
    event.preventDefault()
    setMemberError('')
    try {
      setGroup(await addMember(id, memberName.trim()))
      setMemberName('')
    } catch (err) {
      handleFormError(err, setMemberError)
    }
  }

  async function handleAddExpense(event) {
    event.preventDefault()
    setExpenseError('')
    if (participants.length === 0) {
      setExpenseError('Izaberite bar jednog učesnika.')
      return
    }
    setBusy('expense-form')
    try {
      setGroup(
        await addExpense(id, {
          title: expenseTitle.trim(),
          amount: expenseAmount.trim(),
          payer,
          participants,
        }),
      )
      setExpenseTitle('')
      setExpenseAmount('')
    } catch (err) {
      handleFormError(err, setExpenseError)
    } finally {
      setBusy(null)
    }
  }

  async function handleDeleteExpense(expense) {
    if (!window.confirm(`Obrisati trošak „${expense.title}“?`)) return
    setExpenseListError('')
    setBusy(`expense:${expense.id}`)
    try {
      setGroup(await deleteExpense(id, expense.id))
    } catch (err) {
      handleFormError(err, setExpenseListError)
    } finally {
      setBusy(null)
    }
  }

  async function handleMarkPaid(transfer) {
    setSettlementError('')
    setBusy(`transfer:${transfer.from}|${transfer.to}`)
    try {
      setGroup(
        await markPaid(id, {
          from: transfer.from,
          to: transfer.to,
          amountCents: transfer.amountCents,
        }),
      )
    } catch (err) {
      handleFormError(err, setSettlementError)
    } finally {
      setBusy(null)
    }
  }

  async function handleUnmarkPaid(payment) {
    setSettlementError('')
    setBusy(`payment:${payment.id}`)
    try {
      setGroup(await unmarkPaid(id, payment.id))
    } catch (err) {
      handleFormError(err, setSettlementError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <header className="group-head">
        <Link className="back-link" to="/">← Sve grupe</Link>
        <h1 className="page-title">{group.name}</h1>
      </header>

      <Card title="Učesnici">
        {hasMembers ? (
          <ul className="rows">
            {members.map((member) => (
              <li key={member} className="row">
                <span className="row-title">{member}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Još nema učesnika. Dodajte prvog ispod.</p>
        )}
        <form className="form" onSubmit={handleAddMember}>
          <label className="field">
            <span>Ime učesnika</span>
            <input
              className="input"
              maxLength={40}
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              required
            />
          </label>
          {memberError && <p className="error" role="alert">{memberError}</p>}
          <button type="submit" className="btn btn-primary btn-submit">
            Dodaj
          </button>
        </form>
      </Card>

      <Card title="Novi trošak">
        {!hasMembers && <p className="hint">Dodajte učesnike da biste unijeli trošak.</p>}
        <form className="form" onSubmit={handleAddExpense}>
          <fieldset className="form-fieldset" disabled={!hasMembers}>
            <label className="field">
              <span>Naziv</span>
              <input
                className="input"
                maxLength={60}
                value={expenseTitle}
                onChange={(e) => setExpenseTitle(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Iznos (€)</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Platio/la</span>
              <select
                className="input"
                value={payer}
                onChange={(e) => setExpensePayer(e.target.value)}
                required
              >
                <option value="" disabled>
                  Odaberite učesnika
                </option>
                {members.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </label>
            <div className="field" role="group" aria-labelledby="participants-label">
              <span id="participants-label">Ko učestvuje</span>
              <div className="choice-list">
                {members.map((member) => (
                  <label key={member} className="choice">
                    <input
                      type="checkbox"
                      checked={participants.includes(member)}
                      onChange={() => toggleParticipant(member)}
                    />
                    <span>{member}</span>
                  </label>
                ))}
              </div>
            </div>
            {expenseError && <p className="error" role="alert">{expenseError}</p>}
            <button
              type="submit"
              className="btn btn-primary btn-submit"
              disabled={busy === 'expense-form'}
            >
              Dodaj trošak
            </button>
          </fieldset>
        </form>
      </Card>

      <Card title="Troškovi">
        {group.expenses.length === 0 ? (
          <p className="muted">Još nema troškova. Unesite prvi iznad.</p>
        ) : (
          <ul className="rows">
            {group.expenses.map((expense) => (
              <li key={expense.id} className="row">
                <div className="row-text">
                  <span className="row-title">{expense.title}</span>
                  <span className="row-sub">
                    platila {expense.payer} · {formatParticipants(expense.participants, members)}
                  </span>
                </div>
                <span className="amount">{formatCents(expense.amountCents)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={busy !== null}
                  onClick={() => handleDeleteExpense(expense)}
                >
                  Obriši
                </button>
              </li>
            ))}
          </ul>
        )}
        {expenseListError && <p className="error" role="alert">{expenseListError}</p>}
      </Card>

      {settlementError && <p className="error" role="alert">{settlementError}</p>}
      <Card title="Dugovanja">
        {group.settlement.transfers.length === 0 ? (
          <p className="muted">Svi su kvit.</p>
        ) : (
          <ul className="rows">
            {group.settlement.transfers.map((transfer) => {
              const key = `${transfer.from}|${transfer.to}`
              const row = formatTransfer(transfer)
              return (
                <li key={key} className="row debt-row">
                  <div className="row-text">
                    <span className="row-title">{row.title}</span>
                  </div>
                  <span className="amount">{row.amount}</span>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={busy === `transfer:${key}`}
                      disabled={busy !== null}
                      onChange={() => handleMarkPaid(transfer)}
                    />
                    <span>Isplaćeno</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {group.payments.length > 0 && (
        <Card title="Isplaćeno">
          <ul className="rows">
            {group.payments.map((payment) => (
              <li key={payment.id} className="row">
                <div className="row-text">
                  <span className="row-title">
                    {payment.from} → {payment.to} ·{' '}
                    <span className="amount">{formatCents(payment.amountCents)}</span>
                  </span>
                  <span className="row-sub">{formatDate(payment.createdAt)}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={busy !== null}
                  onClick={() => handleUnmarkPaid(payment)}
                >
                  Poništi
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
