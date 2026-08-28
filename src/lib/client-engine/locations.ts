export interface DatabaseLocation {
  name: string
  storage: string
  devPath: string
  prodPath: string
  persistence: string
  fallback?: string
  stores?: string[]
  actualPath?: string
}

export interface DatabaseLocations {
  sqlite: DatabaseLocation
  vector: DatabaseLocation
  json: DatabaseLocation
  postgres: DatabaseLocation
}

function redactDatabaseUrl(url: string | undefined): string {
  if (!url) return 'non défini'
  try {
    const u = new URL(url)
    const user = u.username ? `${u.username}@` : ''
    const host = u.host
    const db = u.pathname.replace(/^\//, '') || 'base'
    return `${u.protocol}//${user}${host}/${db}`
  } catch {
    return 'non défini'
  }
}

export async function getDatabaseLocations(): Promise<DatabaseLocations> {
  const dbUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DATABASE_URL || process.env.DATABASE_URL : undefined

  const locations: DatabaseLocations = {
    sqlite: {
      name: 'nexaflow-client.sqlite',
      storage: 'OPFS',
      devPath: "navigator.storage.getDirectory() → nexaflow-client.sqlite",
      prodPath: "navigator.storage.getDirectory() → nexaflow-client.sqlite",
      persistence: 'Persistant (OPFS)',
      fallback: 'IndexedDB : nexaflow-client-sqlite',
    },
    vector: {
      name: 'nexaflow-vector-db',
      storage: 'IndexedDB',
      devPath: 'DevTools → Application → IndexedDB → nexaflow-vector-db',
      prodPath: 'DevTools → Application → IndexedDB → nexaflow-vector-db',
      stores: ['documents', 'chunks', 'vectorTree'],
      persistence: 'Persistant',
    },
    json: {
      name: 'nexaflow-json-db',
      storage: 'IndexedDB',
      devPath: 'DevTools → Application → IndexedDB → nexaflow-json-db',
      prodPath: 'DevTools → Application → IndexedDB → nexaflow-json-db',
      stores: ['json-store'],
      persistence: 'Persistant',
    },
    postgres: {
      name: redactDatabaseUrl(dbUrl),
      storage: 'PostgreSQL',
      devPath: dbUrl || 'localhost:5432',
      prodPath: 'Vercel Postgres / base distante',
      persistence: 'Persistant (serveur)',
    },
  }

  try {
    if (typeof navigator !== 'undefined' && 'storage' in navigator) {
      const root = await navigator.storage.getDirectory()
      const handle = await root.getFileHandle('nexaflow-client.sqlite')
      locations.sqlite.actualPath = handle.name
    }
  } catch {
    locations.sqlite.actualPath = "Non trouvé (créé à l'exécution)"
  }

  return locations
}
