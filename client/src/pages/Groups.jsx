import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createGroup, listGroups, UnauthorizedError } from '../api.js'
import Card from '../components/Card.jsx'
import { useAuth } from '../auth.js'

export default function Groups() {
  const { setUser } = useAuth()
  const [groups, setGroups] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function loadGroups() {
    try {
      setGroups(await listGroups())
    } catch (err) {
      if (err instanceof UnauthorizedError) setUser(null)
      else setError(err.message)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    try {
      await createGroup(name.trim())
      setName('')
      await loadGroups()
    } catch (err) {
      if (err instanceof UnauthorizedError) setUser(null)
      else setError(err.message)
    }
  }

  return (
    <>
      <h1 className="page-title">Grupe</h1>

      <Card title="Nova grupa">
        <form className="form" onSubmit={handleCreate}>
          <label className="field">
            <span>Naziv grupe</span>
            <input
              className="input"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-submit">
            Napravi grupu
          </button>
        </form>
      </Card>

      <Card>
        {groups === null ? (
          <p className="muted">Učitavanje…</p>
        ) : groups.length === 0 ? (
          <p className="muted">Još nema grupa. Napravite prvu iznad.</p>
        ) : (
          <ul className="rows">
            {groups.map((group) => (
              <li key={group.id} className="row">
                <Link className="row-link" to={`/groups/${group.id}`}>
                  <span className="row-title">{group.name}</span>
                  <span className="chevron" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
