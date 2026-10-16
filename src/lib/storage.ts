// 기기 저장소. 사용할 수 없는 환경(사생활 보호 모드 등)에서는 메모리에만 둡니다.

const memory = new Map<string, string>()

export const local = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return memory.get(key) ?? null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      memory.set(key, value)
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      memory.delete(key)
    }
  },
  getJSON<T>(key: string): T | null {
    const s = local.get(key)
    if (!s) return null
    try {
      return JSON.parse(s) as T
    } catch {
      return null
    }
  },
  setJSON(key: string, value: unknown) {
    local.set(key, JSON.stringify(value))
  },
}

// 사진은 크기가 커서 IndexedDB에 둡니다
const DB_NAME = 'wcc-photos'
const STORE = 'photos'
const memoryBlobs = new Map<string, Blob>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => req.result.createObjectStore(STORE)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null)
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }),
  )
}

export const blobs = {
  async put(key: string, blob: Blob) {
    memoryBlobs.set(key, blob)
    await tx('readwrite', (s) => s.put(blob, key))
  },
  async get(key: string): Promise<Blob | null> {
    const mem = memoryBlobs.get(key)
    if (mem) return mem
    const b = await tx<Blob>('readonly', (s) => s.get(key) as IDBRequest<Blob>)
    return b ?? null
  },
  async remove(key: string) {
    memoryBlobs.delete(key)
    await tx('readwrite', (s) => s.delete(key))
  },
  async clear() {
    memoryBlobs.clear()
    await tx('readwrite', (s) => s.clear())
  },
}
