import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "./api"
import { useCurrentUser } from "./user-context"
import type { ModelInfo, ModelKey } from "./trace-types"
import { TraceDialog } from "@/components/trace/TraceDialog"

type Ctx = {
  openTrace: (placeId: number, q?: string) => void
  enabled: boolean
  /** Mô hình đang dùng để gợi ý (danh sách "Gợi ý cho bạn", tìm kiếm "Phù hợp với bạn"); popup mở với mô hình này. */
  model: ModelKey
  setModel: (m: ModelKey) => void
  models: ModelInfo[]
}
const TraceCtx = createContext<Ctx>({ openTrace: () => {}, enabled: false, model: "full", setModel: () => {}, models: [] })
const KEY = "foodgo.model"

function readModel(): ModelKey {
  try { return (localStorage.getItem(KEY) as ModelKey) || "full" } catch { return "full" }
}

/** Một popup trực quan hóa dùng chung cho cả trang, và mô hình gợi ý đang chọn. */
export function TraceProvider({ children }: { children: ReactNode }) {
  const { userId } = useCurrentUser()
  const [target, setTarget] = useState<{ placeId: number; q?: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<ModelKey>(readModel)
  const { data: models = [] } = useQuery({
    queryKey: ["models", userId],
    queryFn: () => api.get<ModelInfo[]>("/api/models", { user_id: userId! }),
    enabled: userId !== null,
  })
  // mô hình đã chọn không dùng được cho người dùng này (chưa có đánh giá, thiếu tham số) thì quay về mô hình chính
  const model: ModelKey = models.length && !models.some((m) => m.key === chosen && m.available) ? "full" : chosen
  const setModel = useCallback((m: ModelKey) => {
    setChosen(m)
    try { localStorage.setItem(KEY, m) } catch { /* trình duyệt chặn lưu: chỉ nhớ trong phiên */ }
  }, [])
  useEffect(() => { if (userId === null) setOpen(false) }, [userId])
  const openTrace = useCallback((placeId: number, q?: string) => { setTarget({ placeId, q }); setOpen(true) }, [])
  return (
    <TraceCtx.Provider value={{ openTrace, enabled: userId !== null, model, setModel, models }}>
      {children}
      <TraceDialog open={open} onOpenChange={setOpen} userId={userId} placeId={target?.placeId ?? null} q={target?.q} initialModel={model} />
    </TraceCtx.Provider>
  )
}

export const useTrace = () => useContext(TraceCtx)
