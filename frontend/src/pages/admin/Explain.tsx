import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { BRANCH_LABEL } from "@/lib/format"
import type { Explain as ExplainT, Page, User } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ErrorNote, SafeImage, UserAvatar } from "@/components/common"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const GROUPS: { name: string; tone: string; cols: [string, string][] }[] = [
  { name: "Tĩnh", tone: "bg-surface", cols: [["gnn", "Điểm GNN"], ["near", "Gần khu vực"], ["pop_all", "Phổ biến"], ["cat_match", "Khớp danh mục"], ["price_diff", "Lệch giá"], ["item_rating", "Điểm quán"], ["item_reviews", "Số đánh giá"]] },
  { name: "Động", tone: "bg-[#e8f1fc]", cols: [["pop_recent", "Phổ biến gần đây"], ["sim_last", "Giống quán vừa đến"], ["covisit", "Đồng ghé thăm"], ["near_last", "Gần quán cuối"]] },
  { name: "Đặc thù Đà Nẵng", tone: "bg-[#fdf0e8]", cols: [["asp_match", "Khớp khía cạnh"], ["same_district", "Cùng quận"], ["aud_match", "Khớp đối tượng"]] },
]

const num = (v: number | null | undefined, d = 3) => (v === null || v === undefined ? "-" : v.toFixed(d))

function UserPicker({ value, onPick }: { value: number | null; onPick: (id: number) => void }) {
  const [q, setQ] = useState("")
  const { data } = useQuery({ queryKey: ["users", "picker", q], queryFn: () => api.get<Page<User>>("/api/users", { q, page_size: 8 }) })
  return (
    <div className="max-w-xl space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm người dùng theo tên" aria-label="Tìm người dùng" className="h-10 bg-background" />
      <div className="flex flex-wrap gap-2">
        {data?.items.map((u) => (
          <button key={u.id} type="button" onClick={() => onPick(u.id)}
            className={cn("flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 text-sm transition-colors hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              u.id === value && "border-brand bg-brand-soft")}>
            <UserAvatar user={u} size={24} /> <span className="max-w-40 truncate">{u.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{u.is_new ? "mới · " : ""}{u.total_reviews}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Explain() {
  const [sp, setSp] = useSearchParams()
  const userId = sp.get("user_id") ? Number(sp.get("user_id")) : null
  const { data, error, isFetching } = useQuery({
    queryKey: ["admin", "explain", userId],
    queryFn: () => api.get<ExplainT>("/api/admin/explain", { user_id: userId!, k: 20 }),
    enabled: userId !== null,
  })
  const cold = data?.branch === "nguoi_dung_moi_chua_co_lich_su"
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kiểm tra gợi ý</h1>
        <p className="mt-1 text-sm text-muted-foreground">Xem nhánh xử lý, điểm tầng 1 (GNN dị thể), điểm tầng 2 (LightGBM) và giá trị 14 tiêu chí của từng quán được gợi ý.</p>
      </div>
      <UserPicker value={userId} onPick={(id) => setSp({ user_id: String(id) })} />
      {error && <ErrorNote error={error} />}
      {data && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-sm">
            <span className="flex items-center gap-2 font-medium"><UserAvatar user={data.user} size={28} /> {data.user.name}</span>
            <span>Lịch sử: <b className="tabular-nums">{data.history_count}</b> đánh giá</span>
            <span>Nhánh: <b className={cold ? "text-rating-mid" : "text-rating"}>{BRANCH_LABEL[data.branch]}</b></span>
            {isFetching && <span className="text-muted-foreground">Đang cập nhật…</span>}
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 bg-card">
                {!cold && (
                  <TableRow>
                    <TableHead colSpan={3} />
                    {GROUPS.map((g) => <TableHead key={g.name} colSpan={g.cols.length} className={cn("text-center font-semibold", g.tone)}>{g.name}</TableHead>)}
                  </TableRow>
                )}
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Quán</TableHead>
                  <TableHead className="text-right">{cold ? "Điểm mô hình đơn giản" : "Điểm tầng 2"}</TableHead>
                  {!cold && GROUPS.flatMap((g) => g.cols.map(([k, label]) => <TableHead key={k} className={cn("text-right whitespace-normal", g.tone)}>{label}</TableHead>))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="tabular-nums">{it.rank}</TableCell>
                    <TableCell>
                      <Link to={`/quan/${it.id}`} className="flex items-center gap-2 hover:text-brand">
                        <SafeImage src={it.image_url} alt="" className="size-8 shrink-0 rounded" />
                        <span className="max-w-56 truncate font-medium">{it.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{num(it.score)}</TableCell>
                    {!cold && GROUPS.flatMap((g) => g.cols.map(([k]) => <TableCell key={k} className="text-right tabular-nums">{num(it.criteria?.[k], k === "gnn" ? 3 : 2)}</TableCell>))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {cold && <p className="text-sm text-muted-foreground">Người dùng chưa có đánh giá nên chưa có vector trong đồ thị: điểm = độ phổ biến gần đây + khớp sở thích đã chọn. Sau đánh giá đầu tiên, người dùng chuyển sang GNN dị thể + xếp hạng lại.</p>}
        </>
      )}
    </div>
  )
}
