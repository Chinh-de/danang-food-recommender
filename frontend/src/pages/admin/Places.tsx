import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Eye, EyeOff, Pencil, Plus, Search } from "lucide-react"
import { api } from "@/lib/api"
import { fmtInt, fmtScore } from "@/lib/format"
import type { Page, PlaceCard } from "@/lib/types"
import { ErrorNote, Pagination, SafeImage } from "@/components/common"
import { Input } from "@/components/ui/input"
import { Button, buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function Places() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const qc = useQueryClient()
  const { data, error } = useQuery({
    queryKey: ["admin", "places", q, page],
    queryFn: () => api.get<Page<PlaceCard>>("/api/admin/places", { q, page, page_size: 20 }),
    placeholderData: (prev) => prev,
  })
  const toggle = useMutation({
    mutationFn: (p: PlaceCard) => api.put(`/api/admin/places/${p.id}`, { is_hidden: !p.is_hidden }),
    onSuccess: (_, p) => {
      qc.invalidateQueries()
      toast.success(p.is_hidden ? `Đã hiện lại “${p.name}”` : `Đã ẩn “${p.name}”`)
    },
  })
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quản lý quán</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{data ? `${fmtInt(data.total)} quán` : " "}</p>
        </div>
        <Link to="/admin/quan/moi" className={buttonVariants({ size: "lg", className: "h-10 px-4" })}><Plus aria-hidden /> Thêm quán</Link>
      </div>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Tìm theo tên quán" aria-label="Tìm quán" className="h-10 bg-background pl-9" />
      </div>
      {error && <ErrorNote error={error} />}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-12">ID</TableHead>
              <TableHead>Quán</TableHead>
              <TableHead className="hidden md:table-cell">Quận</TableHead>
              <TableHead className="text-right">Điểm</TableHead>
              <TableHead className="text-right">Đánh giá</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((p) => (
              <TableRow key={p.id} className={p.is_hidden ? "opacity-60" : undefined}>
                <TableCell className="tabular-nums text-muted-foreground">{p.id}</TableCell>
                <TableCell>
                  <Link to={`/quan/${p.id}`} className="flex items-center gap-3 hover:text-brand">
                    <SafeImage src={p.image_url} alt="" className="size-10 shrink-0 rounded-md" />
                    <span className="max-w-72 truncate font-medium">{p.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">{p.district}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtScore(p.stars)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(p.review_count)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {p.is_new && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">Mới</span>}
                    {p.is_hidden && <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-medium">Đã ẩn</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link to={`/admin/quan/${p.id}`} className={buttonVariants({ variant: "ghost", size: "icon-lg" })} aria-label={`Sửa ${p.name}`}><Pencil /></Link>
                    <Button variant="ghost" size="icon-lg" onClick={() => toggle.mutate(p)} disabled={toggle.isPending}
                      aria-label={p.is_hidden ? `Hiện ${p.name}` : `Ẩn ${p.name}`}>{p.is_hidden ? <Eye /> : <EyeOff />}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data && <Pagination page={page} total={data.total} pageSize={data.page_size} onChange={setPage} />}
    </div>
  )
}
