import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, login } from '../api.js'
import Brand from '../components/Brand.jsx'
import Card from '../components/Card.jsx'
import { useAuth } from '../auth.js'

export default function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      setUser(await getMe())
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-brand">
        <Brand large />
      </div>
      <Card title="Prijava">
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Korisničko ime</span>
            <input
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Lozinka</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
            Prijavi se
          </button>
        </form>
      </Card>
    </div>
  )
}
