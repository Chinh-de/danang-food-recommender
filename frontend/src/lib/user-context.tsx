import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "./api"
import type { User } from "./types"

const KEY = "foodgo.userId"

type Ctx = { userId: number | null; user: User | null; setUserId: (id: number | null) => void }
const UserCtx = createContext<Ctx>({ userId: null, user: null, setUserId: () => {} })

function readStored(): number | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === null ? null : Number(v)
  } catch {
    return null
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setId] = useState<number | null>(readStored)
  const setUserId = useCallback((id: number | null) => {
    setId(id)
    try {
      if (id === null) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, String(id))
    } catch {
      /* trình duyệt chặn lưu trữ: chỉ giữ trong phiên */
    }
  }, [])
  const { data, isError } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.get<User>(`/api/users/${userId}`),
    enabled: userId !== null,
    retry: false,
  })
  useEffect(() => {
    if (isError && userId !== null) setUserId(null)   // id không còn trong DB (đã tạo lại DB)
  }, [isError, userId, setUserId])
  return <UserCtx.Provider value={{ userId, user: data ?? null, setUserId }}>{children}</UserCtx.Provider>
}

export const useCurrentUser = () => useContext(UserCtx)
