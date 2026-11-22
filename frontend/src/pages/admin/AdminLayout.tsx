import { NavLink, Outlet } from "react-router-dom"
import { ArrowLeft, Gauge, Microscope, Scale, Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/AppHeader"

const LINKS = [
  { to: "/admin", label: "Tổng quan", icon: Gauge, end: true },
  { to: "/admin/quan", label: "Quản lý quán", icon: Store },
  { to: "/admin/kiem-tra", label: "Kiểm tra gợi ý", icon: Microscope },
  { to: "/admin/so-sanh", label: "So sánh mô hình", icon: Scale },
]

export default function AdminLayout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-foreground/80 hover:bg-muted")
  return (
    <div className="min-h-dvh bg-surface md:flex">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:flex-col md:items-start md:py-5">
          <div className="flex items-center gap-2"><Logo /><span className="rounded bg-foreground px-1.5 py-0.5 text-xs font-semibold text-background">Admin</span></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Quản trị">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={link}><Icon className="size-4" aria-hidden /> {label}</NavLink>
          ))}
          <NavLink to="/" className={cn(link({ isActive: false }), "md:mt-6")}><ArrowLeft className="size-4" aria-hidden /> Về trang chính</NavLink>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8"><Outlet /></main>
    </div>
  )
}
