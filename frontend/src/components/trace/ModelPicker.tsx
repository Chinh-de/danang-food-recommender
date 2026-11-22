import { cn } from "@/lib/utils"
import type { ModelInfo, ModelKey } from "@/lib/trace-types"
import { useTrace } from "@/lib/trace-context"

/** Ô chọn mô hình, nhóm theo "Mô hình đơn giản" / "GNN"; mô hình không dùng được bị khóa kèm lý do. */
export function ModelSelect({ value, onChange, models, disabled, className }: { value: ModelKey; onChange: (m: ModelKey) => void; models: ModelInfo[]; disabled?: boolean; className?: string }) {
  return (
    <select aria-label="Mô hình gợi ý" value={value} onChange={(e) => onChange(e.target.value as ModelKey)} disabled={disabled}
      className={cn("h-9 min-w-0 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
      {(["A", "B"] as const).map((g) => (
        <optgroup key={g} label={g === "A" ? "Mô hình đơn giản" : "GNN"}>
          {models.filter((m) => m.group === g).map((m) => (
            <option key={m.key} value={m.key} disabled={!m.available}>
              {m.label}{m.key === "full" ? " (đề xuất)" : ""}{!m.available && m.reason ? ` (${m.reason})` : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/** Chọn mô hình gợi ý cho cả trang (danh sách gợi ý, tìm kiếm cá nhân hóa, popup "Vì sao gợi ý?"). */
export function ModelPicker({ className }: { className?: string }) {
  const { model, setModel, models, enabled } = useTrace()
  if (!enabled || !models.length) return null
  return (
    <label className={cn("flex items-center gap-2 text-sm whitespace-nowrap max-sm:w-full", className)}>
      <span className="text-muted-foreground">Mô hình</span>
      <ModelSelect value={model} onChange={setModel} models={models} className="max-sm:flex-1" />
    </label>
  )
}

export const modelLabel = (models: ModelInfo[], key: ModelKey) => models.find((m) => m.key === key)?.label ?? key
