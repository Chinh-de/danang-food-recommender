import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, ImageOff, Inbox, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtInt, fmtScore, ratingTone } from "@/lib/format"
import type { PlaceCard as PlaceCardT, User } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { WhyButton } from "@/components/trace/WhyButton"

export function SafeImage({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-surface text-muted-foreground", className)} role="img" aria-label={alt}>
        <ImageOff className="size-6" aria-hidden />
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />
}

export function RatingBadge({ value, className }: { value: number | null | undefined; className?: string }) {
  return (
    <span
      className={cn("inline-flex min-w-9 items-center justify-center rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums text-white", ratingTone(value), className)}
      aria-label={`Điểm ${fmtScore(value)} trên 10`}
    >
      {fmtScore(value)}
    </span>
  )
}

export function UserAvatar({ user, size = 36 }: { user: Pick<User, "name" | "avatar">; size?: number }) {
  const [failed, setFailed] = useState(false)
  const initials = user.name.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() ?? "?"
  return user.avatar && !failed ? (
    <img src={user.avatar} alt="" width={size} height={size} onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-surface object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-accent-foreground"
      style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {initials}
    </span>
  )
}

/** why: hiện nút "Vì sao gợi ý?" (true, hoặc chuỗi từ khóa khi mở từ trang tìm kiếm). */
export function PlaceCard({ place, why }: { place: PlaceCardT; why?: boolean | string }) {
  return (
    <div className="relative">
    <Link to={`/quan/${place.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        <SafeImage src={place.image_url} alt={place.name} className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {place.stars !== null && <RatingBadge value={place.stars} className="absolute top-2 right-2 shadow-sm" />}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {place.is_new && <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-accent-foreground">Mới</span>}
          {place.my_rating !== null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              <Star className="size-3 fill-current" aria-hidden /> Bạn đã đánh giá {fmtScore(place.my_rating)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold group-hover:text-brand">{place.name}</h3>
        <p className="truncate text-sm text-muted-foreground">{place.address ?? place.district}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <span className="truncate text-xs text-muted-foreground">{place.categories.slice(0, 2).join(" · ")}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtInt(place.review_count)} đánh giá</span>
        </div>
      </div>
    </Link>
    {why && <WhyButton placeId={place.id} q={typeof why === "string" ? why : undefined} className="absolute top-2 left-2" />}
    </div>
  )
}

export function PlaceGrid({ places, loading, count = 10, className, why }: { places?: PlaceCardT[]; loading?: boolean; count?: number; className?: string; why?: boolean | string }) {
  const cls = cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)
  if (loading) {
    return (
      <div className={cls}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-2 p-3"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-3 w-3/5" /></div>
          </div>
        ))}
      </div>
    )
  }
  return <div className={cls}>{places?.map((p) => <PlaceCard key={p.id} place={p} why={why} />)}</div>
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 basis-72">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Phân trang">
      <Button variant="outline" size="lg" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
        <ChevronLeft /> Trước
      </Button>
      <span className="text-sm tabular-nums text-muted-foreground">Trang {page} / {pages}</span>
      <Button variant="outline" size="lg" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
        Sau <ChevronRight />
      </Button>
    </nav>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
      Không tải được dữ liệu{error instanceof Error ? `: ${error.message}` : ""}. Kiểm tra backend đang chạy ở cổng 8000.
    </div>
  )
}
