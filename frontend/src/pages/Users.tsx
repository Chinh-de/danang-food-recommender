import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Check, Search, UserPlus } from "lucide-react"
import { api } from "@/lib/api"
import { fmtInt } from "@/lib/format"
import type { Page, User } from "@/lib/types"
import { useCurrentUser } from "@/lib/user-context"
import { cn } from "@/lib/utils"
import { EmptyState, ErrorNote, Pagination, UserAvatar } from "@/components/common"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function Users() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const { userId, setUserId } = useCurrentUser()
  const nav = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ["users", q, page],
    queryFn: () => api.get<Page<User>>("/api/users", { q, page, page_size: 24 }),
    placeholderData: (prev) => prev,
  })
  const pick = (id: number) => {
    setUserId(id)
    nav("/")
  }
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Chọn người dùng</h1>
          <p className="mt-1 text-sm text-muted-foreground">Người dùng thật từ dữ liệu Foody Đà Nẵng, hoặc tạo người dùng mới để thử khởi đầu lạnh.</p>
        </div>
        <Link to="/nguoi-dung/moi" className={buttonVariants({ size: "lg", className: "h-10 px-4" })}>
          <UserPlus aria-hidden /> Tạo người dùng mới
        </Link>
      </div>
      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Tìm theo tên" aria-label="Tìm người dùng theo tên" className="h-10 pl-9" />
      </div>
      {error ? <ErrorNote error={error} /> : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : data && data.items.length === 0 ? <EmptyState title="Không có người dùng phù hợp" /> : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.items.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => pick(u.id)}
                  className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    u.id === userId && "border-brand bg-brand-soft/60")}>
                  <UserAvatar user={u} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {u.is_new ? "Người dùng mới · " : ""}{fmtInt(u.total_reviews)} đánh giá
                    </span>
                  </span>
                  {u.id === userId && <Check className="size-5 text-brand" aria-label="Đang chọn" />}
                </button>
              </li>
            ))}
          </ul>
          {data && <Pagination page={page} total={data.total} pageSize={data.page_size} onChange={setPage} />}
        </>
      )}
    </div>
  )
}
