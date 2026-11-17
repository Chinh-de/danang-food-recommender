import { useState, type FormEvent } from "react"
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom"
import { Search, UserRound, Settings2 } from "lucide-react"
import { useCurrentUser } from "@/lib/user-context"
import { UserAvatar } from "./common"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-1.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="FoodGo, về trang chủ">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">F</span>
      <span className="text-xl font-bold tracking-tight">Food<span className="text-brand">Go</span></span>
    </Link>
  )
}

export function AppHeader() {
  const { user } = useCurrentUser()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get("q") ?? "")
  const submit = (e: FormEvent) => {
    e.preventDefault()
    nav(`/tim-kiem${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`)
  }
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4">
        <Logo />
        <span className="hidden text-sm text-muted-foreground lg:inline">Đà Nẵng</span>
        <form onSubmit={submit} className="relative mx-auto w-full max-w-xl" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm quán ăn, món, địa chỉ…" aria-label="Tìm kiếm"
            className="h-10 rounded-full bg-surface pl-9 text-base md:text-sm" />
        </form>
        <NavLink to="/admin" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "hidden h-10 sm:inline-flex")}>
          <Settings2 aria-hidden /> Admin
        </NavLink>
        <Link to={user ? "/ho-so" : "/nguoi-dung"}
          className="flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium transition-colors hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {user ? <UserAvatar user={user} size={28} /> : <span className="flex size-7 items-center justify-center rounded-full bg-surface"><UserRound className="size-4" aria-hidden /></span>}
          <span className="hidden max-w-32 truncate sm:inline">{user ? user.name : "Chọn người dùng"}</span>
        </Link>
      </div>
    </header>
  )
}
