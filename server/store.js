import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'db.json')

let writeQueue = Promise.resolve()

function dataFilePath() {
  return process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : DEFAULT_DATA_FILE
}

// Records written before payments existed have no `payments` field.
function withDefaults(db) {
  for (const group of db.groups) group.payments ??= []
  return db
}

async function readDbFile(file) {
  try {
    return withDefaults(JSON.parse(await fs.readFile(file, 'utf8')))
  } catch (error) {
    if (error.code === 'ENOENT') return { groups: [] }
    throw error
  }
}

async function writeDbFile(file, db) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tempFile = `${file}.${randomUUID()}.tmp`
  await fs.writeFile(tempFile, JSON.stringify(db, null, 2))
  await fs.rename(tempFile, file)
}

export function loadDb() {
  return readDbFile(dataFilePath())
}

// Runs load -> mutate -> save as one step, queued behind earlier writes.
// If mutate throws, nothing is saved.
export function updateDb(mutate) {
  const run = writeQueue.then(async () => {
    const file = dataFilePath()
    const db = await readDbFile(file)
    const result = await mutate(db)
    await writeDbFile(file, db)
    return result
  })
  writeQueue = run.catch(() => {})
  return run
}
