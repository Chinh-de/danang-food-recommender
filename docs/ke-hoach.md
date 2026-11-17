# FoodGo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây FoodGo, trang khám phá quán ăn Đà Nẵng chạy mô hình gợi ý đã huấn luyện trên Foody, có cập nhật gợi ý ngay sau đánh giá và xử lý khởi đầu lạnh.

**Architecture:** Backend FastAPI giữ toàn bộ trạng thái gợi ý trong bộ nhớ (`Engine`): đọc SQLite, dựng đồ thị dị thể, lan truyền bằng SciPy với tham số GNN đã huấn luyện, tính tiêu chí tầng 2, chấm bằng LightGBM. Mỗi lần ghi (đánh giá, quán mới, người dùng mới) dựng lại trạng thái và thay thế nguyên khối. Frontend React gọi API qua TanStack Query.

**Tech Stack:** Python 3.12, uv, FastAPI, NumPy, SciPy, pandas, LightGBM, SQLite (stdlib `sqlite3`), pytest; Vite, React, TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query, Leaflet.

**Spec:** `foodgo/docs/thiet-ke.md`. Mã gốc của mô hình: `notebooks/foody_huan_luyen.ipynb` (ô 1, 10, 12, 15, 16, 18, 21, 26).

## Global Constraints

- Mọi thứ nằm trong `foodgo/`. Không sửa file ngoài thư mục này; `notebooks/`, `data/`, `foody/` chỉ đọc.
- Backend dùng uv, không dùng pip. `requires-python = ">=3.12,<3.13"`. PyTorch không nằm trong dependency của backend; chỉ dùng một lần qua `uv run --with torch` ở Task 1.
- Mã gợi ý chuyển từ notebook sang, giữ nguyên công thức và hằng số: `TAU_DAYS=180`, `W_FLOOR=0.2`, `N_LAYERS=3`, `EMB_DIM=64`, `N_CAND=200`, `LAST_N=3`, `RECENT_N=20`, `RADIUS_Q=0.95`, `MIN_CAT_ITEMS=3`, thứ tự quan hệ `["UI","IC","IP","IF","ID","IA"]`, `r_global_km` và `rel_weights` đọc từ `train_meta.json`.
- Chỉ đánh giá kèm điểm là tín hiệu gợi ý. Không có lưu quán, yêu thích, "Đang hot", "thường đi tiếp".
- Đồng hồ hệ thống chỉ dùng trong backend; giao diện chỉ hiển thị mốc giờ thật.
- Toàn bộ chữ trên giao diện bằng tiếng Việt. Tên sản phẩm FoodGo, màu nhấn đỏ, không dùng logo Foody.
- ID trong API là chỉ số của mô hình: `users.id = u`, `places.id = i`. ID gốc của Foody lưu ở cột `foody_id`.
- Dự án chưa dùng git: không có bước commit. Mỗi task kết thúc bằng lệnh kiểm tra của nó.
- Tên nhánh gợi ý: `mo_hinh_chinh`, `nguoi_dung_moi_co_lich_su`, `nguoi_dung_moi_chua_co_lich_su`.

## Review Focus

1. Một người đánh giá lại quán đã đánh giá: đánh giá cũ được thay bằng đánh giá mới, không tạo hai cạnh. (Task 4)
2. Quán mới thiếu trường hoặc có giá trị ngoài từ vựng của mô hình (danh mục lạ, không có giá, không có đối tượng): API trả 422 cho trường bắt buộc, bỏ qua giá trị ngoài từ vựng, không lỗi khi tính gợi ý. (Task 5, 7)
3. Người dùng mới chỉ đánh giá quán mới (cả hai nút đều có vector 0): vẫn nhận gợi ý, qua nhánh `nguoi_dung_moi_chua_co_lich_su`. (Task 5)
4. Quán bị ẩn: biến mất khỏi gợi ý, tìm kiếm, quán tương tự; trang chi tiết và lịch sử đánh giá cũ vẫn mở được. (Task 5, 6)
5. Ảnh quán hoặc ảnh đại diện không tải được, đánh giá không có tiêu đề hay nội dung: giao diện hiện ảnh thay thế, không vỡ bố cục. (Task 8, 10)

---

## Cấu trúc file

```
foodgo/
  artifacts/                 gnn.npz, ranker.txt, train_meta.json, user_emb.npy, item_emb.npy
  data/foodgo.db
  backend/
    pyproject.toml
    app/
      main.py                tạo FastAPI, CORS, nạp Engine khi khởi động
      config.py              đường dẫn, hằng số mô hình
      db.py                  kết nối SQLite, lược đồ, các hàm đọc/ghi
      clock.py               đồng hồ hệ thống
      schemas.py             kiểu Pydantic của API
      recsys/
        catalog.py           ma trận thuộc tính và mảng metadata của quán
        graph.py             trọng số cạnh, chuẩn hóa, dựng đồ thị
        propagate.py         lan truyền GNN bằng SciPy
        features.py          hồ sơ người dùng và tiêu chí tầng 2
        cold.py              mô hình đơn giản cho người dùng chưa có đánh giá
        engine.py            trạng thái phục vụ và các hàm gợi ý
      api/
        users.py  places.py  reviews.py  recs.py  admin.py
    scripts/
      export_model.py        .pt -> gnn.npz (chạy một lần, cần torch)
      prepare_data.py        CSV + JSONL -> foodgo.db
      check_notebook.py      so khớp vector và chỉ số với notebook
    tests/
  frontend/
    src/
      lib/api.ts  lib/types.ts  lib/user-context.tsx
      components/            PlaceCard, PlaceGrid, RatingBadge, UserAvatar, AppHeader, ...
      pages/                 Home, Users, NewUser, Search, PlaceDetail, Profile
      pages/admin/           Dashboard, Places, PlaceForm, Explain
```

---

### Task 1: Khung backend và dữ liệu

**Files:**
- Create: `foodgo/backend/pyproject.toml`, `app/config.py`, `app/db.py`, `app/clock.py`, `scripts/export_model.py`, `scripts/prepare_data.py`
- Test: `foodgo/backend/tests/test_data.py`

**Interfaces:**
- Produces:
  - `config.ARTIFACTS: Path`, `config.DB_PATH: Path` (ghi đè được bằng biến môi trường `FOODGO_DB`), `config.META: dict` (nội dung `train_meta.json`), các hằng số ở Global Constraints.
  - `artifacts/gnn.npz` với khóa `emb` (float32, `[N0, 64]`, `N0` = số nút của mô hình).
  - `db.connect(path=None) -> sqlite3.Connection` (row_factory = `sqlite3.Row`).
  - `clock.now_ts(conn) -> int`: `data_end_ts + (time.time() - db_created_real)`.
  - Lược đồ:

```sql
CREATE TABLE users(id INTEGER PRIMARY KEY, foody_id INTEGER, name TEXT NOT NULL, avatar TEXT,
  total_reviews INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, prefs TEXT);            -- prefs: JSON {categories, prices, districts}
CREATE TABLE places(id INTEGER PRIMARY KEY, foody_id INTEGER, name TEXT NOT NULL, address TEXT, district TEXT,
  lat REAL, lon REAL, categories TEXT, price REAL, price_min REAL, price_max REAL, delivery REAL,
  stars REAL, review_count INTEGER, target_audience TEXT, image_url TEXT, image_full_url TEXT,
  description TEXT, opening TEXT, phone TEXT, asp_0 REAL, asp_1 REAL, asp_2 REAL, asp_3 REAL, asp_4 REAL,
  is_new INTEGER DEFAULT 0, is_hidden INTEGER DEFAULT 0);
CREATE TABLE reviews(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, place_id INTEGER NOT NULL,
  rating REAL NOT NULL, ts INTEGER NOT NULL, created_at TEXT NOT NULL, title TEXT, text TEXT, pictures TEXT,
  part TEXT, is_new INTEGER DEFAULT 0, UNIQUE(user_id, place_id));                    -- ts: đồng hồ hệ thống; created_at: giờ thật ISO
CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT);                              -- data_end_ts, db_created_real
```

  - `places.stars`, `review_count`, `categories`, `target_audience`, `opening` giữ nguyên định dạng của `items.csv` (chuỗi phân tách bằng `", "`; `opening` là chuỗi JSON `[[thứ, phút_mở, phút_đóng], ...]`). `reviews.part` giữ `train`/`valid`/`test` cho dữ liệu gốc, `NULL` cho đánh giá mới.

- [ ] **Step 1:** `uv init` trong `foodgo/backend`, đặt `requires-python`, thêm dependency: `fastapi`, `uvicorn[standard]`, `numpy`, `scipy`, `pandas`, `lightgbm`; nhóm dev: `pytest`, `httpx`.
- [ ] **Step 2:** Viết `scripts/export_model.py`: copy `ranker.txt`, `train_meta.json`, `user_emb.npy`, `item_emb.npy` từ `notebooks/ket_qua_chay/` vào `foodgo/artifacts/`; nạp `gnn_di_the.pt` và lưu `emb.weight` thành `gnn.npz`. Chạy: `uv run --with torch --extra-index-url https://download.pytorch.org/whl/cpu scripts/export_model.py`. Kỳ vọng in `emb (N0, 64)` với `N0 = 2696 + 1698 + 47 + 4 + 2 + số quận + số đối tượng`.
- [ ] **Step 3:** Viết test `tests/test_data.py` (dùng DB thật sau khi chạy script):

```python
def test_counts(conn):
    assert conn.execute("select count(*) from users").fetchone()[0] == 2696
    assert conn.execute("select count(*) from places").fetchone()[0] == 1698
    assert conn.execute("select count(*) from reviews").fetchone()[0] == 46548
def test_ids_are_model_indices(conn):
    assert [r[0] for r in conn.execute("select id from places order by id limit 3")] == [0, 1, 2]
def test_review_text_joined(conn):   # nội dung lấy được từ reviews_final.jsonl
    assert conn.execute("select count(*) from reviews where text is not null and text != ''").fetchone()[0] > 30000
def test_clock_starts_after_data(conn):
    end = int(conn.execute("select value from settings where key='data_end_ts'").fetchone()[0])
    assert end == conn.execute("select max(ts) from reviews").fetchone()[0]
    assert clock.now_ts(conn) >= end
```

- [ ] **Step 4:** Chạy `uv run pytest tests/test_data.py`, kỳ vọng FAIL (chưa có DB).
- [ ] **Step 5:** Viết `scripts/prepare_data.py`: đọc ba CSV (`encoding="utf-8-sig"`), nối `reviews_final.jsonl` theo cặp (`user_id`, `place_id`) của Foody để lấy `title`, `text`, `picture_urls`, `created_at`; nối `places_final.jsonl` theo `place_id` để lấy `phone`, `price_min`, `price_max`, `image_full_url`. `created_at` của dữ liệu gốc lấy từ cột `date`. Ghi `settings`. Script xóa và tạo lại DB mỗi lần chạy.
- [ ] **Step 6:** Chạy `uv run scripts/prepare_data.py` rồi `uv run pytest tests/test_data.py`, kỳ vọng PASS. Nếu ngưỡng 30.000 của `test_review_text_joined` không đạt, in tỷ lệ nối được và báo lại thay vì hạ ngưỡng.

---

### Task 2: Đồ thị và lan truyền GNN

**Files:**
- Create: `app/recsys/catalog.py`, `app/recsys/graph.py`, `app/recsys/propagate.py`, `scripts/check_notebook.py`
- Test: `tests/test_gnn.py`

**Interfaces:**
- Consumes: `config`, `db.connect`, `artifacts/gnn.npz`.
- Produces:
  - `catalog.Catalog` (dataclass), dựng bằng `Catalog.from_places(places: pd.DataFrame, i_model: int) -> Catalog`. Trường: `n_items`, `i_model`, `lat`, `lon`, `price` (NaN nếu thiếu), `rating` (= `stars / 5`), `reviews` (= `log1p(review_count)`), `hidden: bool[]`, `attrs: dict[str, sp.csr_matrix]` với khóa `IC, IP, IF, ID, IA` (số hàng = `n_items`), `ic_dense` (đã chuẩn hóa L2 theo hàng), `asp`, `d_dense`, `a_dense`, `cat_vocab`, `districts`, `audiences`.
  - Từ vựng: `cat_vocab` lấy từ `train_meta.json`; `districts` và `audiences` là `sorted(unique)` trên **`i_model` quán đầu tiên** (như `multi_hot` ở ô 10). `asp` trừ trung bình cột tính trên `i_model` quán đầu, NaN thành 0. Giá trị ngoài từ vựng bị bỏ qua.
  - `graph.ui_weight(hist: pd.DataFrame, mode: str) -> np.ndarray` (ô 12; `hist` có cột `u, i, r, ts`).
  - `graph.Layout(u_model, i_model, n_attr, n_users, n_items)` với `user_node(u)`, `item_node(i)`, `n_nodes`. Nút của mô hình giữ nguyên chỉ số `[người dùng | quán | IC | IP | IF | ID | IA]`; người dùng mới rồi quán mới nối tiếp sau `N0`.
  - `graph.build_graph(hist, cat: Catalog, layout: Layout, ui="dynamic") -> dict[str, sp.csr_matrix]` (mỗi ma trận `n_nodes × n_nodes`, chuẩn hóa `norm_bipartite` như ô 12).
  - `propagate.propagate(emb0: np.ndarray, g: dict, alpha: dict[str, float], layout: Layout, n_layers=3) -> tuple[np.ndarray, np.ndarray]` trả `(Eu [n_users, 64], Ei [n_items, 64])`. `emb0` được nối thêm hàng 0 cho nút mới. Nút của mô hình lấy trung bình các tầng `0..L`; nút mới lấy trung bình các tầng `1..L`.

- [ ] **Step 1:** Viết test:

```python
def test_embeddings_match_notebook(conn):
    # đồ thị train + valid, đúng như notebook dùng khi lưu vector (ô 26)
    Eu, Ei = run_propagation(conn, parts=("train", "valid"))
    assert np.abs(Eu - np.load(ARTIFACTS / "user_emb.npy")).max() < 1e-4
    assert np.abs(Ei - np.load(ARTIFACTS / "item_emb.npy")).max() < 1e-4
def test_dynamic_weight_formula():
    hist = pd.DataFrame(dict(u=[0, 0], i=[0, 1], r=[1.0, 1.0], ts=[0, 180 * 86400]))
    w = ui_weight(hist, "dynamic")
    assert w[1] == pytest.approx(1.0) and w[0] == pytest.approx(0.2 + 0.8 * np.exp(-1), abs=1e-6)
def test_new_nodes_get_vectors(conn):
    # thêm 1 người dùng mới đánh giá quán 0 và 1 quán mới có danh mục, quận
    Eu, Ei = run_propagation_with_new_nodes(conn)
    assert np.linalg.norm(Eu[-1]) > 0 and np.linalg.norm(Ei[-1]) > 0
    assert 0.2 < np.linalg.norm(Ei[-1]) / np.median(np.linalg.norm(Ei[:-1], axis=1)) < 5
```

- [ ] **Step 2:** Chạy `uv run pytest tests/test_gnn.py`, kỳ vọng FAIL.
- [ ] **Step 3:** Viết `catalog.py`, `graph.py`, `propagate.py` theo ô 10, 12, 18 của notebook. `alpha` lấy từ `META["rel_weights"]`.
- [ ] **Step 4:** Chạy test, kỳ vọng PASS. Nếu `test_embeddings_match_notebook` lệch, so từng quan hệ (số cạnh, tổng trọng số) với notebook trước khi sửa ngưỡng.

---

### Task 3: Tiêu chí tầng 2 và xếp hạng lại

**Files:**
- Create: `app/recsys/features.py`
- Modify: `scripts/check_notebook.py`
- Test: `tests/test_rerank.py`

**Interfaces:**
- Consumes: `Catalog`, `Eu`, `Ei` từ Task 2; `artifacts/ranker.txt`.
- Produces:
  - `features.build_phase(hist: pd.DataFrame, cat: Catalog, n_users: int) -> dict`: chuyển `make_phase` (ô 15) không có phần `target`; thêm `radius = max(META["r_global_km"], r_personal)`, `pop_keys`, `cov_keys` (ô 21).
  - `features.candidates(P, Eu, Ei, users: np.ndarray, cat, n_cand=200, allow: np.ndarray | None = None) -> dict(cand, keep, raw, z)`: chuyển `stage` (ô 21) gồm đủ 14 tiêu chí. `allow` là mặt nạ quán được phép (dùng để loại quán ẩn); quán trong lịch sử luôn bị loại.
  - `features.rank(D, booster: lgb.Booster, k: int) -> tuple[np.ndarray, np.ndarray]` trả `(top [n, k], score [n, k])`, `-1` ở ô trống. Thứ tự cột của `X` theo `META["feats"]`.
  - `scripts/check_notebook.py`: lịch sử = train + valid, đích = test, in bảng Recall/NDCG/HitRate/MRR @10/20/50 (hàm `evaluate` ô 16).

- [ ] **Step 1:** Viết test:

```python
def test_metrics_match_notebook(conn):
    m = run_check(conn)                      # hàm chính của check_notebook.py
    assert m["NDCG@20"] == pytest.approx(0.1277, abs=0.002)
    assert m["Recall@20"] == pytest.approx(0.2363, abs=0.003)
def test_history_excluded(conn):
    D, top = recommend_raw(conn, users=np.array([0]))
    seen = set(conn_history(conn, 0))
    assert not seen & set(top[0][top[0] >= 0])
def test_allow_mask(conn):
    D, top = recommend_raw(conn, users=np.array([0]), block=[top_first_item])
    assert top_first_item not in top[0]
```

- [ ] **Step 2:** Chạy, kỳ vọng FAIL.
- [ ] **Step 3:** Viết `features.py` theo ô 10, 15, 21.
- [ ] **Step 4:** Chạy `uv run pytest tests/test_rerank.py` và `uv run scripts/check_notebook.py`, kỳ vọng PASS và bảng chỉ số khớp dòng cuối của bảng kết quả trong notebook. **Không làm Task 4 khi bước này chưa đạt.**

---

### Task 4: Engine phục vụ và cập nhật ngay

**Files:**
- Create: `app/recsys/engine.py`
- Modify: `app/db.py`
- Test: `tests/test_engine.py`, `tests/conftest.py`

**Interfaces:**
- Consumes: Task 1–3.
- Produces:

```python
@dataclass
class RecItem:  place_id: int; score: float; gnn_score: float | None; criteria: dict[str, float] | None
@dataclass
class RecResult: branch: str; items: list[RecItem]

class Engine:
    def __init__(self, db_path: Path): ...
    def reload(self) -> float                      # dựng lại toàn bộ trạng thái từ DB, trả số giây
    def recommend(self, user_id: int, k: int = 20, explain: bool = False) -> RecResult
    def similar(self, place_id: int, k: int = 12) -> list[int]          # cosine trên Ei, bỏ quán ẩn
    def personal_scores(self, user_id: int) -> np.ndarray | None        # điểm tầng 1 cho mọi quán, None nếu không có vector
    def add_review(self, user_id, place_id, rating, title, text) -> int # ghi DB rồi reload
```

  - `db.upsert_review(conn, user_id, place_id, rating, title, text, ts, created_at) -> int`: thay đánh giá cũ của cùng cặp nếu có; cập nhật `places.stars` (trung bình cộng dồn với đánh giá mới) và `places.review_count`.
  - Trạng thái (đồ thị, `Eu`, `Ei`, `P`, `Catalog`) nằm trong một đối tượng bất biến; `reload` dựng đối tượng mới rồi gán một lần. Ghi được tuần tự hóa bằng `threading.Lock`.
  - Lịch sử khi phục vụ là toàn bộ bảng `reviews`, `r = rating / 10`.
  - `conftest.py`: fixture `engine` chạy trên bản sao tạm của `data/foodgo.db` (đặt `FOODGO_DB`), để test ghi không đổi DB thật.

- [ ] **Step 1:** Viết test:

```python
def test_recommend_main_branch(engine):
    r = engine.recommend(0, k=20)
    assert r.branch == "mo_hinh_chinh" and len(r.items) == 20
def test_review_changes_recs_immediately(engine):
    before = [x.place_id for x in engine.recommend(0, 20).items]
    engine.add_review(0, before[0], 9.0, "ngon", "")
    after = [x.place_id for x in engine.recommend(0, 20).items]
    assert before[0] not in after and len(after) == 20
def test_review_twice_replaces(engine):
    engine.add_review(0, 5, 3.0, "", ""); engine.add_review(0, 5, 9.0, "", "")
    assert count_reviews(engine, user=0, place=5) == 1
def test_explain_has_14_criteria(engine):
    it = engine.recommend(0, 5, explain=True).items[0]
    assert set(it.criteria) == set(META["static"] + META["dynamic"] + META["extra"])
def test_reload_time(engine):
    assert engine.reload() < 2.0
```

- [ ] **Step 2:** Chạy, kỳ vọng FAIL.
- [ ] **Step 3:** Viết `engine.py`, `db.upsert_review`.
- [ ] **Step 4:** Chạy `uv run pytest tests/test_engine.py`, kỳ vọng PASS. Ghi lại thời gian `reload` đo được; nếu trên 0,5 giây, báo lại con số (thiết kế cho phép chuyển sang chỉ tính lại người dùng vừa đánh giá).

---

### Task 5: Khởi đầu lạnh

**Files:**
- Create: `app/recsys/cold.py`
- Modify: `app/recsys/engine.py`, `app/db.py`
- Test: `tests/test_cold.py`

**Interfaces:**
- Produces:
  - `db.create_user(conn, name: str, prefs: dict | None) -> int` (id nối tiếp, `is_new=1`).
  - `db.create_place(conn, data: dict) -> int`, `db.update_place(conn, id, data: dict)` (gồm `is_hidden`).
  - `Engine.add_user(name, prefs) -> int`, `Engine.add_place(data) -> int`, `Engine.update_place(id, data)`: ghi DB rồi `reload`.
  - `Engine.new_places(user_id: int | None, k: int = 12) -> list[int]`: quán `is_new=1` chưa ẩn; có vector người dùng thì xếp theo điểm tầng 1, không thì theo id giảm dần.
  - `cold.score(prefs: dict | None, cat: Catalog, pop_recent: np.ndarray, pop_all: np.ndarray) -> np.ndarray`:

```
phổ_biến = zscore(log1p(pop_recent) + 0.25 * log1p(pop_all))      # pop_recent: 180 ngày trước clock.now_ts
điểm = phổ_biến + 1.0 * khớp_danh_mục + 0.5 * khớp_quận + 0.5 * khớp_giá
khớp_* = 1 nếu quán có ít nhất một giá trị thuộc sở thích đã chọn, ngược lại 0; prefs trống thì cả ba bằng 0
```

  - Chọn nhánh trong `Engine.recommend`:

| Điều kiện | Nhánh |
|---|---|
| Người dùng của mô hình (`is_new=0`) | `mo_hinh_chinh` |
| `is_new=1`, có đánh giá, chuẩn vector > 1e-8 | `nguoi_dung_moi_co_lich_su` (đi qua tầng 1 + tầng 2 như nhánh chính) |
| `is_new=1`, chưa có đánh giá hoặc vector bằng 0 | `nguoi_dung_moi_chua_co_lich_su` (`cold.score`, `gnn_score=None`, `criteria=None`) |

  - Quán ẩn bị loại ở mọi nhánh. Quán mới: `rating` = trung bình `stars/5` của các quán của mô hình khi chưa có đánh giá.

- [ ] **Step 1:** Viết test:

```python
def test_new_user_without_reviews_uses_simple_model(engine):
    u = engine.add_user("Khách mới", {"categories": ["Café/Dessert"], "prices": [], "districts": ["Quận Hải Châu"]})
    r = engine.recommend(u, 20)
    assert r.branch == "nguoi_dung_moi_chua_co_lich_su" and len(r.items) == 20
    assert sum(is_cafe(x.place_id) for x in r.items) >= 10
def test_new_user_switches_after_first_review(engine):
    u = engine.add_user("Khách mới", None); engine.add_review(u, 0, 9.0, "", "")
    assert engine.recommend(u, 20).branch == "nguoi_dung_moi_co_lich_su"
def test_new_place_is_recommendable(engine):
    p = engine.add_place(SAMPLE_PLACE)             # đủ danh mục, quận, giá, tọa độ
    assert p in engine.new_places(0)
    assert engine.personal_scores(0)[p] != 0
def test_new_user_reviewing_only_new_place(engine):
    p = engine.add_place(SAMPLE_PLACE | {"categories": "Danh mục lạ", "district": "Quận lạ", "target_audience": None, "price": None})
    u = engine.add_user("Khách mới", None); engine.add_review(u, p, 8.0, "", "")
    assert len(engine.recommend(u, 20).items) == 20
def test_hidden_place_disappears(engine):
    top = engine.recommend(0, 20).items[0].place_id
    engine.update_place(top, {"is_hidden": 1})
    assert top not in [x.place_id for x in engine.recommend(0, 20).items]
    assert all(top not in engine.similar(i) for i in range(20))
```

- [ ] **Step 2:** Chạy, kỳ vọng FAIL.
- [ ] **Step 3:** Viết `cold.py`, mở rộng `engine.py`, `db.py`.
- [ ] **Step 4:** Chạy `uv run pytest`, kỳ vọng toàn bộ PASS (kể cả Task 2–4).

---

### Task 6: API người dùng

**Files:**
- Create: `app/main.py`, `app/schemas.py`, `app/api/users.py`, `app/api/places.py`, `app/api/reviews.py`, `app/api/recs.py`
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: `Engine`, `db`.
- Produces (JSON, tên trường dùng chung với frontend):

```ts
type User = { id: number; name: string; avatar: string | null; total_reviews: number; is_new: boolean; prefs: Prefs | null }
type Prefs = { categories: string[]; prices: number[]; districts: string[] }
type PlaceCard = { id: number; name: string; address: string; district: string; categories: string[]; price: number | null;
                   stars: number; review_count: number; image_url: string | null; is_new: boolean }
type Place = PlaceCard & { lat: number; lon: number; price_min: number | null; price_max: number | null; delivery: boolean;
                   target_audience: string[]; image_full_url: string | null; description: string | null; phone: string | null;
                   opening: [number, number, number][]; is_open_now: boolean | null; aspects: { name: string; score: number | null }[];
                   is_hidden: boolean }
type Review = { id: number; user: Pick<User, "id" | "name" | "avatar">; place: Pick<PlaceCard, "id" | "name" | "image_url">;
                rating: number; created_at: string; title: string | null; text: string | null; pictures: string[] }
type Page<T> = { items: T[]; total: number; page: number; page_size: number }
type Recs = { branch: string; items: PlaceCard[] }
```

| Đường dẫn | Tham số | Trả về |
|---|---|---|
| `GET /api/users` | `q`, `page`, `page_size=24` | `Page<User>`, xếp theo `total_reviews` giảm dần |
| `GET /api/users/{id}` | | `User` |
| `GET /api/users/{id}/reviews` | `page`, `page_size=10` | `Page<Review>`, mới nhất trước |
| `POST /api/users` | `{name, prefs?}` | `User`, 201 |
| `GET /api/places` | `q`, `district`, `category`, `price`, `open_now`, `sort=personal\|rating\|reviews`, `user_id`, `page`, `page_size=24` | `Page<PlaceCard>`; `sort=personal` cần `user_id` có vector, không thì dùng `rating` |
| `GET /api/places/{id}` | | `Place` (quán ẩn vẫn trả) |
| `GET /api/places/{id}/reviews` | `page`, `page_size=10` | `Page<Review>` |
| `GET /api/places/{id}/similar` | `k=12` | `PlaceCard[]` |
| `POST /api/reviews` | `{user_id, place_id, rating (1–10), title?, text?}` | `Review`, 201 |
| `GET /api/recommendations` | `user_id`, `k=20` | `Recs` |
| `GET /api/home` | `user_id?` | `{ recommended: Recs \| null, new_places: PlaceCard[], districts: {name, count}[], categories: {name, count}[] }` |
| `GET /api/meta` | | `{ districts: string[], categories: string[], audiences: string[], prices: {value, label}[] }` |

  - Nhãn mức giá suy từ `price_bins` trong `data/foody_processed/meta.json`: 1 = "Dưới 50.000đ", 2 = "50.000–150.000đ", 3 = "150.000–300.000đ", 4 = "Trên 300.000đ".
  - `is_open_now` tính theo giờ thật của máy, `null` khi không có `opening`. Trước khi viết, đọc cách `foody_tien_xu_ly.ipynb` mã hóa `opening` để hiểu số đầu của mỗi bộ ba.
  - Tìm kiếm và lọc bỏ quán ẩn. `q` so khớp không phân biệt hoa thường và không dấu trên tên và địa chỉ.
  - CORS cho `http://localhost:5173`. `Engine` tạo trong `lifespan`, lấy qua dependency `get_engine`.
  - Lỗi: 404 khi không có id; 422 khi `rating` ngoài 1–10 hoặc `name` trống.

- [ ] **Step 1:** Viết test với `TestClient` trên fixture `engine`:

```python
def test_home_without_user(client):
    d = client.get("/api/home").json()
    assert d["recommended"] is None and len(d["districts"]) > 0
def test_home_with_user(client):
    d = client.get("/api/home", params={"user_id": 0}).json()
    assert d["recommended"]["branch"] == "mo_hinh_chinh" and len(d["recommended"]["items"]) == 20
def test_post_review_updates_recs(client):
    first = client.get("/api/recommendations", params={"user_id": 0}).json()["items"][0]["id"]
    assert client.post("/api/reviews", json={"user_id": 0, "place_id": first, "rating": 9}).status_code == 201
    ids = [p["id"] for p in client.get("/api/recommendations", params={"user_id": 0}).json()["items"]]
    assert first not in ids
def test_search_filters(client):
    items = client.get("/api/places", params={"district": "Quận Hải Châu", "q": "ca phe"}).json()["items"]
    assert items and all(p["district"] == "Quận Hải Châu" for p in items)
def test_validation(client):
    assert client.post("/api/reviews", json={"user_id": 0, "place_id": 0, "rating": 11}).status_code == 422
    assert client.get("/api/places/999999").status_code == 404
def test_create_user_then_recs(client):
    u = client.post("/api/users", json={"name": "Lan"}).json()
    assert client.get("/api/recommendations", params={"user_id": u["id"]}).json()["branch"] == "nguoi_dung_moi_chua_co_lich_su"
```

- [ ] **Step 2:** Chạy, kỳ vọng FAIL.
- [ ] **Step 3:** Viết các route và schema.
- [ ] **Step 4:** Chạy `uv run pytest tests/test_api.py`, kỳ vọng PASS. Chạy `uv run uvicorn app.main:app --port 8000` và mở `/docs` để xác nhận đủ đường dẫn.

---

### Task 7: API admin

**Files:**
- Create: `app/api/admin.py`
- Modify: `app/main.py`, `app/schemas.py`
- Test: `tests/test_admin_api.py`

**Interfaces:**
- Produces:

```ts
type Stats = { users: number; places: number; reviews: number; new_users: number; new_places: number; new_reviews: number;
               cold_users: number; cold_places: number; hidden_places: number; last_reload_ms: number }
type PlaceInput = { name: string; address: string; district: string; lat: number; lon: number; categories: string[];
                    price: number | null; target_audience: string[]; delivery: boolean; image_url: string | null;
                    description: string | null; phone: string | null; opening: [number, number, number][] }
type ExplainItem = PlaceCard & { rank: number; score: number; gnn_score: number | null; criteria: Record<string, number> | null }
type Explain = { user: User; branch: string; history_count: number; items: ExplainItem[] }
```

| Đường dẫn | Trả về |
|---|---|
| `GET /api/admin/stats` | `Stats` (`cold_users`: người dùng mới chưa có đánh giá; `cold_places`: quán mới chưa có đánh giá) |
| `GET /api/admin/places` (`q`, `page`, `include_hidden=true`) | `Page<PlaceCard & {is_hidden}>` |
| `POST /api/admin/places` | `Place`, 201; bắt buộc `name`, `address`, `district`, `lat`, `lon`, ít nhất một danh mục |
| `PUT /api/admin/places/{id}` | `Place`; nhận `PlaceInput` từng phần và `is_hidden` |
| `GET /api/admin/explain` (`user_id`, `k=20`) | `Explain` |

  - `criteria` trả giá trị thô của 14 tiêu chí, khóa là tên trong `META` (`gnn`, `near`, ...).

- [ ] **Step 1:** Viết test:

```python
def test_add_place_appears_in_new(client):
    p = client.post("/api/admin/places", json=SAMPLE_INPUT).json()
    assert p["is_new"] and p["id"] in [x["id"] for x in client.get("/api/home", params={"user_id": 0}).json()["new_places"]]
    assert client.get("/api/admin/stats").json()["cold_places"] == 1
def test_missing_required_field(client):
    assert client.post("/api/admin/places", json={k: v for k, v in SAMPLE_INPUT.items() if k != "district"}).status_code == 422
def test_hide_place(client):
    client.put("/api/admin/places/3", json={"is_hidden": True})
    assert 3 not in [p["id"] for p in client.get("/api/places", params={"page_size": 100}).json()["items"]]
    assert client.get("/api/places/3").json()["is_hidden"] is True
def test_explain(client):
    e = client.get("/api/admin/explain", params={"user_id": 0}).json()
    assert e["branch"] == "mo_hinh_chinh" and len(e["items"][0]["criteria"]) == 14
```

- [ ] **Step 2:** Chạy, kỳ vọng FAIL.
- [ ] **Step 3:** Viết `admin.py`.
- [ ] **Step 4:** Chạy `uv run pytest`, kỳ vọng toàn bộ PASS.

---

### Task 8: Khung frontend, hệ thiết kế, chọn và tạo người dùng

**Files:**
- Create: `foodgo/frontend/` (Vite), `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/user-context.tsx`, `src/components/{AppHeader,PlaceCard,PlaceGrid,RatingBadge,UserAvatar,SafeImage,EmptyState}.tsx`, `src/pages/{Users,NewUser}.tsx`, `src/App.tsx`
- Create: `foodgo/docs/he-thiet-ke.md`

**Interfaces:**
- Consumes: API Task 6 (kiểu ở khối `ts` của Task 6, 7 chép vào `types.ts`).
- Produces:
  - `api.get<T>(path, params?)`, `api.post<T>(path, body)`, `api.put<T>(path, body)`; gốc API lấy từ `VITE_API_URL`, mặc định `http://localhost:8000`.
  - `useCurrentUser(): { user: User | null; setUserId(id: number | null): void }`, lưu id ở `localStorage` khóa `foodgo.userId`.
  - `<PlaceCard place={PlaceCard} />`, `<PlaceGrid places loading />`, `<RatingBadge value />` (thang 10), `<SafeImage src alt fallback />` (hiện ảnh thay thế khi lỗi tải), `<UserAvatar user />`.
  - Route: `/`, `/nguoi-dung`, `/nguoi-dung/moi`, `/tim-kiem`, `/quan/:id`, `/ho-so`, `/admin`, `/admin/quan`, `/admin/quan/moi`, `/admin/quan/:id`, `/admin/kiem-tra`.

- [ ] **Step 1:** Tạo dự án `npm create vite@latest frontend -- --template react-ts`; cài Tailwind và shadcn/ui theo hướng dẫn hiện hành của shadcn cho Vite; thêm `react-router-dom`, `@tanstack/react-query`, `lucide-react`.
- [ ] **Step 2:** Gọi skill `ui-ux-pro-max` để chọn hệ thiết kế cho trang khám phá quán ăn phong cách Foody (nền trắng, đỏ làm màu nhấn, lưới thẻ dày thông tin). Ghi kết quả vào `docs/he-thiet-ke.md`: bảng màu (token CSS), phông chữ hỗ trợ tiếng Việt, thang cỡ chữ, bo góc, khoảng cách, quy tắc thẻ quán. Đưa token vào cấu hình Tailwind/shadcn.
- [ ] **Step 3:** Viết `api.ts`, `types.ts`, `user-context.tsx`, các component dùng chung, `AppHeader` (logo FoodGo, ô tìm kiếm chuyển sang `/tim-kiem?q=`, người dùng đang chọn kèm nút đổi, liên kết Admin).
- [ ] **Step 4:** Viết trang `Users` (ô tìm theo tên, lưới người dùng có phân trang, nút "Tạo người dùng mới", bấm vào người dùng thì chọn và về trang chủ) và `NewUser` (tên bắt buộc; sở thích danh mục, mức giá, quận lấy từ `/api/meta`, bỏ qua được).
- [ ] **Step 5:** Kiểm tra: `npm run build` không lỗi kiểu. Chạy backend và `npm run dev`; trên trình duyệt: chọn một người dùng, tải lại trang vẫn giữ; tạo người dùng mới thấy tên ở thanh điều hướng; avatar lỗi hiện ảnh thay thế.

---

### Task 9: Trang chủ và tìm kiếm

**Files:**
- Create: `src/pages/Home.tsx`, `src/pages/Search.tsx`, `src/components/{SectionHeader,FilterBar,Pagination,BrowseChips}.tsx`

**Interfaces:**
- Consumes: `GET /api/home`, `GET /api/places`, `GET /api/meta`; component Task 8.

- [ ] **Step 1:** `Home`: có người dùng thì hiện "Gợi ý cho bạn" (lưới 20 thẻ); `Recs.branch` bằng `nguoi_dung_moi_chua_co_lich_su` thì thêm dòng "Hãy đánh giá vài quán để nhận gợi ý sát hơn". Chưa chọn người dùng thì thay mục này bằng khối mời chọn người dùng. Bên dưới: "Quán mới" (ẩn mục khi rỗng), duyệt theo quận và theo danh mục (bấm chuyển sang `/tim-kiem` kèm bộ lọc).
- [ ] **Step 2:** `Search`: trạng thái bộ lọc nằm trên URL (`q`, `district`, `category`, `price`, `open_now`, `sort`, `page`); lựa chọn sắp xếp "Phù hợp với bạn" chỉ hiện khi có người dùng; có trạng thái đang tải, rỗng, lỗi.
- [ ] **Step 3:** Kiểm tra: `npm run build`. Trên trình duyệt: đổi người dùng thì "Gợi ý cho bạn" đổi; lọc quận + danh mục cho kết quả đúng; tải lại trang giữ bộ lọc; bố cục ổn ở bề rộng 375 px và 1280 px.

---

### Task 10: Chi tiết quán, viết đánh giá, hồ sơ

**Files:**
- Create: `src/pages/PlaceDetail.tsx`, `src/pages/Profile.tsx`, `src/components/{ReviewList,ReviewForm,AspectBars,OpeningHours,PlaceMap}.tsx`

**Interfaces:**
- Consumes: `GET /api/places/{id}`, `/reviews`, `/similar`, `POST /api/reviews`, `GET /api/users/{id}`, `/users/{id}/reviews`.

- [ ] **Step 1:** Thêm `leaflet`, `react-leaflet`. `PlaceDetail`: ảnh lớn, tên, điểm, địa chỉ, quận, danh mục, khoảng giá, điện thoại, trạng thái mở cửa và bảng giờ, 5 điểm khía cạnh dạng thanh (bỏ khía cạnh `null`), mô tả, bản đồ OpenStreetMap, danh sách đánh giá có phân trang, "Quán tương tự". Quán ẩn hiện nhãn "Quán đã ngừng hiển thị".
- [ ] **Step 2:** `ReviewForm`: điểm 1–10, tiêu đề, nội dung; chưa chọn người dùng thì hiện lời mời chọn người dùng thay cho form. Gửi xong: thêm đánh giá vào đầu danh sách, hiện thông báo "Gợi ý của bạn đã được cập nhật", làm mới các truy vấn `home`, `recommendations`, `places`.
- [ ] **Step 3:** `Profile`: thông tin người dùng, lịch sử đánh giá có phân trang; đánh giá thiếu tiêu đề hoặc nội dung vẫn hiển thị gọn.
- [ ] **Step 4:** Kiểm tra: `npm run build`. Trên trình duyệt: ghi lại 5 quán đầu "Gợi ý cho bạn", viết đánh giá cho quán đầu, quay về trang chủ thấy quán đó biến mất và danh sách đổi; đánh giá mới hiện ngày hôm nay (giờ thật); người dùng mới tạo viết đánh giá đầu tiên rồi nhận gợi ý cá nhân hóa.

---

### Task 11: Giao diện admin

**Files:**
- Create: `src/pages/admin/{AdminLayout,Dashboard,Places,PlaceForm,Explain}.tsx`

**Interfaces:**
- Consumes: API Task 7, `GET /api/meta`, `GET /api/users`.

- [ ] **Step 1:** `AdminLayout` (thanh bên: Tổng quan, Quản lý quán, Kiểm tra gợi ý, liên kết về trang chính) và `Dashboard` (các ô số liệu từ `Stats`).
- [ ] **Step 2:** `Places` (bảng có tìm kiếm, phân trang, nhãn "Mới" và "Đã ẩn", nút ẩn/hiện, nút sửa) và `PlaceForm` dùng chung cho thêm và sửa: danh mục, quận, đối tượng chọn từ `/api/meta`; tọa độ nhập số hoặc bấm trên bản đồ; hiển thị lỗi 422 theo từng trường.
- [ ] **Step 3:** `Explain`: ô chọn người dùng (tìm theo tên), hiện nhánh xử lý, số đánh giá trong lịch sử, bảng gợi ý gồm thứ hạng, quán, điểm tầng 2, điểm tầng 1 và 14 tiêu chí chia ba nhóm cột (tĩnh, động, đặc thù). Tên cột tiếng Việt: `gnn` "Điểm GNN", `near` "Gần khu vực", `pop_all` "Phổ biến", `cat_match` "Khớp danh mục", `price_diff` "Lệch giá", `item_rating` "Điểm quán", `item_reviews` "Số đánh giá", `pop_recent` "Phổ biến gần đây", `sim_last` "Giống quán vừa đến", `covisit` "Đồng ghé thăm", `near_last` "Gần quán cuối", `asp_match` "Khớp khía cạnh", `same_district` "Cùng quận", `aud_match` "Khớp đối tượng". Nhánh người dùng chưa có lịch sử: ẩn các cột tiêu chí, ghi rõ đang dùng mô hình đơn giản.
- [ ] **Step 4:** Kiểm tra: `npm run build`. Trên trình duyệt: thêm một quán, thấy nó ở "Quán mới" trên trang chủ và số "quán lạnh" tăng 1; ẩn quán thì nó biến khỏi tìm kiếm; trang Kiểm tra gợi ý hiện đúng nhánh cho ba loại người dùng.

---

### Task 12: Rà soát giao diện và chạy thử toàn hệ thống

**Files:**
- Create: `foodgo/README.md`
- Modify: các file frontend theo kết quả rà soát

- [ ] **Step 1:** Gọi skill `design-taste-frontend` để rà soát toàn bộ trang người dùng và admin so với `docs/he-thiet-ke.md`; sửa các điểm nó chỉ ra.
- [ ] **Step 2:** Viết `README.md`: yêu cầu (uv, Node), ba lệnh chuẩn bị (`export_model.py`, `prepare_data.py`, `npm install`), hai lệnh chạy (`uv run uvicorn app.main:app --port 8000`, `npm run dev`), cách tạo lại DB sạch trước buổi demo, kịch bản demo.
- [ ] **Step 3:** Tạo lại DB sạch và chạy đúng kịch bản demo trên trình duyệt:
  1. Chọn một người dùng nhiều đánh giá, xem "Gợi ý cho bạn".
  2. Viết đánh giá cho một quán được gợi ý, thấy danh sách đổi.
  3. Tạo người dùng mới có sở thích, thấy gợi ý theo sở thích; viết một đánh giá, thấy gợi ý cá nhân hóa.
  4. Vào admin thêm quán, thấy quán ở "Quán mới".
  5. Mở Kiểm tra gợi ý cho cả hai người dùng, đối chiếu nhánh và tiêu chí.
- [ ] **Step 4:** Chạy `uv run pytest` và `uv run scripts/check_notebook.py` lần cuối, kỳ vọng PASS và chỉ số khớp notebook. Tạo lại DB sạch để sẵn sàng demo.
