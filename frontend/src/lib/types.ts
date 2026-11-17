export type Prefs = { categories: string[]; prices: number[]; districts: string[] }

export type User = {
  id: number
  name: string
  avatar: string | null
  total_reviews: number
  is_new: boolean
  prefs: Prefs | null
}

export type PlaceCard = {
  id: number
  name: string
  address: string | null
  district: string | null
  categories: string[]
  price: number | null
  stars: number | null
  review_count: number
  image_url: string | null
  is_new: boolean
  is_hidden: boolean
  my_rating: number | null
}

export type Place = PlaceCard & {
  lat: number
  lon: number
  price_min: number | null
  price_max: number | null
  price_label: string | null
  delivery: boolean
  target_audience: string[]
  image_full_url: string | null
  description: string | null
  phone: string | null
  opening: [number, number, number][]
  is_open_now: boolean | null
  aspects: { name: string; score: number | null }[]
}

export type Review = {
  id: number
  user: { id: number; name: string; avatar: string | null }
  place: { id: number; name: string; image_url: string | null }
  rating: number
  created_at: string
  title: string | null
  text: string | null
  pictures: string[]
  is_new: boolean
}

export type Page<T> = { items: T[]; total: number; page: number; page_size: number }

export type Branch = "mo_hinh_chinh" | "nguoi_dung_moi_co_lich_su" | "nguoi_dung_moi_chua_co_lich_su"

export type Recs = { branch: Branch; items: PlaceCard[] }

export type Facet = { name: string; count: number }

export type Home = {
  recommended: Recs | null
  revisit: PlaceCard[]
  new_places: PlaceCard[]
  districts: Facet[]
  categories: Facet[]
}

export type Meta = {
  districts: string[]
  categories: string[]
  audiences: string[]
  prices: { value: number; label: string }[]
}

export type Stats = {
  users: number
  places: number
  reviews: number
  new_users: number
  new_places: number
  new_reviews: number
  cold_users: number
  cold_places: number
  hidden_places: number
  last_reload_ms: number
}

export type PlaceInput = {
  name: string
  address: string
  district: string
  lat: number
  lon: number
  categories: string[]
  price: number | null
  target_audience: string[]
  delivery: boolean
  image_url: string | null
  description: string | null
  phone: string | null
  opening: [number, number, number][]
}

export type ExplainItem = PlaceCard & {
  rank: number
  score: number
  gnn_score: number | null
  criteria: Record<string, number> | null
}

export type Explain = { user: User; branch: Branch; history_count: number; items: ExplainItem[] }
