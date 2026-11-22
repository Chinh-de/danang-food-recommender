import { Sparkles } from "lucide-react"
import { useTrace } from "@/lib/trace-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Nút mở popup "Vì sao gợi ý?"; ẩn khi chưa chọn người dùng. */
export function WhyButton({ placeId, q, variant = "card", className }: { placeId: number; q?: string; variant?: "card" | "detail"; className?: string }) {
  const { openTrace, enabled } = useTrace()
  if (!enabled) return null
  if (variant === "detail") {
    return <Button variant="outline" onClick={() => openTrace(placeId, q)} className={className}><Sparkles aria-hidden /> Vì sao gợi ý cho bạn?</Button>
  }
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openTrace(placeId, q) }}
      className={cn("inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-foreground/10 transition-colors hover:bg-brand hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 outline-none", className)}>
      <Sparkles className="size-3.5" aria-hidden /> Vì sao gợi ý?
    </button>
  )
}
