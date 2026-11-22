/** Dữ liệu trả về từ GET /api/trace (backend/app/recsys/trace.py). */
export type Check = { recomputed: number | number[]; engine: number | number[]; err: number } | null

export type NodeRef = { node: number; kind: "user" | "place" | "IC" | "IP" | "IF" | "ID" | "IA"; id: number; label: string }

export type RelContribution = {
  rel: string; rel_label: string; alpha: number; n: number; others: number
  neighbors: (NodeRef & { a_hat: number; norm: number })[]
  sum: number[]; weighted: number[]; norm: number
}

export type LayerSide = { rels: RelContribution[]; result: number[]; check: Check }

export type Criterion = {
  key: string; label: string; group: "static" | "dynamic" | "extra"
  raw: number | null; z: number; percentile: number | null; dist: number[]
  detail: Record<string, unknown>
}

export type Contribution = { key: string; label: string; group: Criterion["group"]; raw: number; z: number; total: number }

export type Trace = {
  user: { id: number; name: string }
  place: { id: number; name: string }
  branch: "mo_hinh_chinh" | "nguoi_dung_moi_co_lich_su" | "nguoi_dung_moi_chua_co_lich_su"
  n_layers: number
  rels: string[]
  rel_labels: Record<string, string>
  data: {
    place: {
      name: string; categories: string[]; price: number | null; price_label: string | null; delivery: boolean
      district: string | null; target_audience: string[]; aspects: { name: string; score: number | null }[]
      lat: number; lon: number; stars: number | null; review_count: number; is_new: boolean
    }
    user: { name: string; n_history: number; is_new: boolean; history: { place_id: number; name: string; rating: number; date: string }[] }
  }
  search?: { q: string; matched: number; rank: number | null; name_match: boolean }
  cold?: {
    prefs: { categories?: string[]; districts?: string[]; prices?: number[] }
    pop_recent: number; pop_all: number; recent_days: number; pop_pct: number
    match: { category: boolean; district: boolean; price: boolean }
    weights: { category: number; district: number; price: number }
    score: number; rank: number; pool: number; check: Check
  }
  nodes?: {
    n_nodes: number; user_node: NodeRef; place_node: NodeRef
    place_attrs: (NodeRef & { rel: string; rel_label: string })[]
    n_users_of_place: number; n_places_of_user: number; not_nodes: string[]
  }
  weights?: {
    mode?: "binary" | "static" | "dynamic"; tau: number; floor: number; t_ref: string | null; check: Check
    edges: { place_id: number; name: string; rating: number; r: number; dt_days: number; decay: number; w: number; a_hat: number; date: string }[]
  }
  norm?: {
    ui: { name: string; w: number; d_u: number; d_i: number; a_hat: number; engine: number }[]
    attrs: { rel: string; label: string; d_place: number; d_attr: number; a_hat: number; engine: number }[]
    check: Check
  }
  e0?: { user: number[]; place: number[]; user_is_new_node: boolean; place_is_new_node: boolean; dim: number }
  layers?: { l: number; place: LayerSide; user: LayerSide }[]
  stage1?: {
    layers_user: number[][]; layers_place: number[][]; e_user: number[]; e_place: number[]; y: number
    check_e: Check; check_y: Check; rank: number | null; pool: number; seen: boolean; in_top200: boolean; n_cand: number
    hist: { counts: number[]; edges: number[] }
  }
  criteria?: { real: boolean; n_cand: number; criteria: Criterion[] }
  lgbm?: { base: number; score: number; contributions: Contribution[]; n_trees: number; check: Check }
  result?: {
    rank: number; in_topk: boolean; topk: number; stage1_rank: number | null; real: boolean
    top: { id: number; name: string }[]; engine_rank: number | null; check: Check
  }
}

// ---------- nút chuyển mô hình (backend/app/recsys/trace_models.py) ----------
export type ModelKey = "pop" | "near" | "content" | "userknn" | "itemknn" | "svd" | "gcn" | "gnn_bin" | "gnn_rating" | "gnn_dyn" | "full"
export type ModelInfo = { key: ModelKey; label: string; group: "A" | "B"; description: string; available: boolean; reason: string | null }

export type Ranking = {
  score: number; rank: number | null; ties: number; pool: number; seen: boolean; in_topk: boolean; topk: number
  top: { id: number; name: string }[]; hist: { counts: number[]; edges: number[] }; check: Check
}

export type ClassicPop = { count: number; n_reviews: number; most: { name: string; count: number }[] }
export type ClassicNear = {
  points: { name: string; lat: number; lon: number }[]; n_rows: number; center: { lat: number; lon: number }
  place: { lat: number; lon: number }; km: number; bonus: number; rating10: number; check_center: Check
}
export type ClassicContent = {
  blocks: { name: string; place: { label: string; value: number }[]; user: { label: string; value: number }[]; contrib: number }[]
  history: { name: string; r: number }[]; n_history: number; dim: number
}
export type ClassicUserKnn = {
  k: number; n_users: number; n_history: number
  neighbors: { name: string; sim: number; common: number; r: number | null }[]
  n_contrib: number; contributors: { name: string; sim: number; r: number; prod: number }[]; rest: number
}
export type ClassicItemKnn = { n_raters: number; n_history: number; rows: { name: string; r: number; sim: number; prod: number; common: number }[]; rest: number }
export type ClassicSvd = {
  shape: [number, number]; nnz: number; density: number; k: number; n_history: number
  a: number[]; v: number[]; prod: number[]; top: { dim: number; a: number; v: number; prod: number }[]
}
export type GcnSide = {
  n: number; neighbors: { label: string; a_hat: number; norm: number }[]
  agg: number[]; lin: number[]; out: number[]; relu: boolean; n_zero: number; check: Check
}
export type ClassicGcn = {
  e0: { user: number[]; place: number[] }; layers: { l: number; place: GcnSide; user: GcnSide }[]
  y: number; e_user: number[]; e_place: number[]; n_nodes: number
}

export type TraceAny = Trace & {
  model: ModelKey; models: ModelInfo[]; ranking?: Ranking; alpha?: Record<string, number>
  classic?: ClassicPop | ClassicNear | ClassicContent | ClassicUserKnn | ClassicItemKnn | ClassicSvd | ClassicGcn
}
