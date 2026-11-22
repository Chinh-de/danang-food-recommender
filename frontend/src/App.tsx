import { useEffect } from "react"
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UserProvider } from "@/lib/user-context"
import { TraceProvider } from "@/lib/trace-context"
import { AppHeader } from "@/components/AppHeader"
import { Toaster } from "@/components/ui/sonner"
import { EmptyState } from "@/components/common"
import Home from "@/pages/Home"
import Users from "@/pages/Users"
import NewUser from "@/pages/NewUser"
import Search from "@/pages/Search"
import PlaceDetail from "@/pages/PlaceDetail"
import Profile from "@/pages/Profile"
import AdminLayout from "@/pages/admin/AdminLayout"
import Dashboard from "@/pages/admin/Dashboard"
import Places from "@/pages/admin/Places"
import PlaceForm from "@/pages/admin/PlaceForm"
import Explain from "@/pages/admin/Explain"
import Compare from "@/pages/admin/Compare"

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } })

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)   // đổi trang thì về đầu trang; không trả giá trị (Chrome mới trả Promise)
  }, [pathname])
  return null
}

function PublicLayout() {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main><Outlet /></main>
      <footer className="mt-16 border-t py-6 text-center text-xs text-muted-foreground">
        FoodGo · Demo hệ gợi ý GNN dị thể trọng số động trên dữ liệu Foody Đà Nẵng
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <UserProvider>
        <TraceProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="nguoi-dung" element={<Users />} />
              <Route path="nguoi-dung/moi" element={<NewUser />} />
              <Route path="tim-kiem" element={<Search />} />
              <Route path="quan/:id" element={<PlaceDetail />} />
              <Route path="ho-so" element={<Profile />} />
              <Route path="*" element={<div className="mx-auto max-w-xl px-4 py-16"><EmptyState title="Không tìm thấy trang" /></div>} />
            </Route>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="quan" element={<Places />} />
              <Route path="quan/moi" element={<PlaceForm />} />
              <Route path="quan/:id" element={<PlaceForm />} />
              <Route path="kiem-tra" element={<Explain />} />
              <Route path="so-sanh" element={<Compare />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </TraceProvider>
        <Toaster position="top-center" richColors />
      </UserProvider>
    </QueryClientProvider>
  )
}
