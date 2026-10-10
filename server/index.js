import { createApp } from './app.js'

const REQUIRED_ENV = ['SESSION_SECRET', 'APP_USERNAME', 'APP_PASSWORD']

function assertConfig() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Nedostaju env varijable: ${missing.join(', ')}`)
  }
}

assertConfig()

const port = Number(process.env.PORT) || 3001
createApp().listen(port, () => {
  console.log(`Server radi na portu ${port}`)
})
