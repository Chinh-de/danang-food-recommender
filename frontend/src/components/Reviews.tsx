import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { fmtDate } from "@/lib/format"
import type { Review, User } from "@/lib/types"
import { cn } from "@/lib/utils"
import { RatingBadge, SafeImage, UserAvatar } from "./common"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function ReviewItem({ r, showPlace = false }: { r: Review; showPlace?: boolean }) {
  return (
    <article className="flex gap-3 border-b py-4 last:border-b-0">
      {showPlace ? (
        <Link to={`/quan/${r.place.id}`} className="shrink-0"><SafeImage src={r.place.image_url} alt={r.place.name} className="size-14 rounded-md" /></Link>
      ) : <UserAvatar user={r.user} size={40} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showPlace
            ? <Link to={`/quan/${r.place.id}`} className="font-medium hover:text-brand">{r.place.name}</Link>
            : <span className="font-medium">{r.user.name}</span>}
          <RatingBadge value={r.rating} className="text-xs" />
          <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
        </div>
        {r.title && <p className="mt-1.5 font-medium">{r.title}</p>}
        {r.text?.trim() && <p className="mt-1 line-clamp-6 text-sm leading-relaxed whitespace-pre-line text-foreground/85">{r.text.trim().replace(/\n\s*\n+/g, "\n")}</p>}
        {r.pictures.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {r.pictures.slice(0, 4).map((p) => <SafeImage key={p} src={p} alt="Ảnh đánh giá" className="size-20 shrink-0 rounded-md" />)}
          </div>
        )}
      </div>
    </article>
  )
}

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function ReviewForm({ placeId, user, onDone }: { placeId: number; user: User | null; onDone?: (r: Review) => void }) {
  const [rating, setRating] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: () => api.post<Review>("/api/reviews", { user_id: user!.id, place_id: placeId, rating, title: title || null, text: text || null }),
    onSuccess: (r) => {
      for (const k of ["home", "recommendations", "places", "place", "place-reviews", "user", "user-reviews", "similar", "admin"]) qc.invalidateQueries({ queryKey: [k] })
      toast.success("Đã gửi đánh giá. Gợi ý của bạn đã được cập nhật.")
      setRating(null); setTitle(""); setText("")
      onDone?.(r)
    },
  })
  if (!user) {
    return (
      <div className="rounded-lg border bg-surface p-4 text-sm">
        <p className="mb-3">Chọn một người dùng để viết đánh giá.</p>
        <Link to="/nguoi-dung" className={buttonVariants({ size: "lg", className: "h-10 px-4" })}>Chọn người dùng</Link>
      </div>
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (rating) m.mutate()
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm"><UserAvatar user={user} size={28} /> Đánh giá với tên <b>{user.name}</b></div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Điểm của bạn (thang 10)</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Điểm">
          {SCORES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={rating === s} onClick={() => setRating(s)}
              className={cn("size-10 cursor-pointer rounded-md border text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                rating === s ? "border-brand bg-brand text-white" : "hover:bg-muted")}>
              {s}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="rv-title">Tiêu đề</Label>
        <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-10 text-base md:text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-text">Nội dung</Label>
        <Textarea id="rv-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} rows={4} className="text-base md:text-sm" />
      </div>
      {m.isError && <p className="text-sm text-destructive" role="alert">Không gửi được đánh giá. Thử lại sau.</p>}
      <Button type="submit" size="lg" className="h-10 px-5" disabled={!rating || m.isPending}>
        {m.isPending ? "Đang gửi…" : rating ? "Gửi đánh giá" : "Chọn điểm để gửi"}
      </Button>
    </form>
  )
}
