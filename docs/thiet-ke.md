# FoodGo: thiết kế hệ thống demo

FoodGo là trang khám phá quán ăn Đà Nẵng, dùng mô hình gợi ý đã huấn luyện trên dữ liệu Foody (GNN dị thể trọng số động + xếp hạng lại LightGBM). Tài liệu này mô tả hệ thống cần xây; kế hoạch từng bước sẽ được viết sau khi thiết kế được duyệt.

## 1. Mục đích

Chứng minh mô hình chạy được trong một sản phẩm giống thật: người dùng vào tìm chỗ ăn, nhận gợi ý cá nhân hóa, viết đánh giá và thấy gợi ý đổi ngay. Hệ thống cũng xử lý được hai tình huống mô hình chưa từng thấy: người dùng mới và quán mới.

**Mục tiêu**
- Mô hình đã huấn luyện là nguồn gợi ý chính cho mọi người dùng có lịch sử.
- Gợi ý thay đổi ngay sau khi người dùng viết đánh giá, không huấn luyện lại.
- Người dùng mới và quán mới vẫn nhận và được gợi ý (khởi đầu lạnh).
- Giao diện theo phong cách Foody, tên FoodGo, hiển thị metadata thật đã crawl.

**Không làm**
- Đăng nhập bằng mật khẩu, phân quyền, quản lý người dùng, duyệt đánh giá.
- Lưu quán, yêu thích, check-in (mô hình không được huấn luyện trên các tín hiệu này).
- Huấn luyện lại mô hình từ giao diện.
- Triển khai lên máy chủ; hệ thống chạy trên máy cá nhân.

**Điều làm hỏng demo dù chạy được**
- Gợi ý lấy từ danh sách tính sẵn, không qua mô hình.
- Mô hình đơn giản lấn vai mô hình chính ở người dùng đã có lịch sử.
- Kết quả của backend lệch với notebook huấn luyện.

## 2. Cấu trúc thư mục

```
foodgo/
  backend/        FastAPI, quản lý bằng uv (pyproject.toml, uv.lock)
    app/
      api/        các route
      recsys/     đồ thị, GNN, tiêu chí tầng 2, khởi đầu lạnh
      db/         SQLite
    scripts/      chuẩn bị dữ liệu, kiểm tra khớp notebook
    tests/
  frontend/       Vite + React + TypeScript + Tailwind + shadcn/ui
  artifacts/      file mô hình copy từ notebooks/ket_qua_chay
  data/           foodgo.db (sinh ra từ script)
  docs/
```

Nguồn đầu vào (chỉ đọc, không sửa):
- `notebooks/ket_qua_chay/`: `gnn_di_the.pt`, `ranker.txt`, `train_meta.json`, `user_emb.npy`, `item_emb.npy`.
- `data/foody_processed/`: `items.csv`, `users.csv`, `interactions.csv`, `meta.json`.
- `foody/`: `reviews_final.jsonl` (nội dung, ảnh đánh giá), `places_final.jsonl` (điện thoại, khoảng giá, ảnh lớn).

## 3. Dữ liệu

Một script chuẩn bị dữ liệu chạy một lần, tạo `data/foodgo.db` (SQLite):

| Bảng | Nội dung | Nguồn |
|---|---|---|
| `places` | 1.698 quán của mô hình: tên, địa chỉ, quận, tọa độ, danh mục, mức giá, khoảng giá, điểm, 5 điểm khía cạnh, đối tượng, giờ mở cửa, ảnh, mô tả, điện thoại; cờ `is_new`, `is_hidden` | `items.csv` + `places_final.jsonl` |
| `users` | 2.696 người dùng của mô hình: tên, ảnh đại diện, số đánh giá; cờ `is_new`; sở thích ban đầu (chỉ người dùng mới) | `users.csv` |
| `reviews` | 46.548 đánh giá: người dùng, quán, điểm (thang 10), thời điểm, tiêu đề, nội dung, ảnh; cờ `is_new` | `interactions.csv` + `reviews_final.jsonl` |

- Toàn bộ đánh giá (train, valid, test) là lịch sử khi phục vụ.
- Quán do admin thêm và người dùng mới tạo được cấp chỉ số nối tiếp sau các chỉ số của mô hình.
- Cột `booking` trống 100% nên không dùng.

**Đồng hồ hệ thống.** Dữ liệu kết thúc ngày 12/07/2024. Nếu đánh giá mới ghi theo giờ thật (2026) thì mọi tương tác cũ của người đó rơi xuống mức sàn của trọng số thời gian, và "phổ biến gần đây" rỗng. Vì vậy hệ thống dùng đồng hồ riêng: bắt đầu ngay sau ngày cuối dữ liệu và trôi theo thời gian thật từ lúc tạo CSDL. Mọi chỗ cần "hiện tại" trong phần gợi ý đều lấy từ một hàm duy nhất.

Đồng hồ này chỉ dùng bên trong backend cho việc tính gợi ý và không hiển thị lên giao diện. Mỗi đánh giá mới lưu hai mốc thời gian: mốc theo đồng hồ hệ thống để mô hình dùng, và mốc theo giờ thật để giao diện hiển thị.

## 4. Gợi ý

### 4.1 Mô hình chính

Giữ đúng định nghĩa trong `notebooks/foody_huan_luyen.ipynb`; mã backend chuyển từ notebook sang, không viết lại theo cách khác.

- **Tầng 1.** Dựng đồ thị dị thể với các quan hệ UI, IC, IP, IF, ID, IA từ lịch sử hiện tại, cạnh người dùng–quán có trọng số `r × (0,2 + 0,8·exp(−Δt/180 ngày))`, Δt tính từ tương tác mới nhất của chính người dùng. Chạy một lượt lan truyền của mô hình đã huấn luyện để lấy vector người dùng và quán. Lấy 200 ứng viên theo tích vô hướng.
- **Tầng 2.** Tính 14 tiêu chí (tĩnh, động, đặc thù Đà Nẵng) cho 200 ứng viên, chuẩn hóa như notebook, chấm bằng `ranker.txt`, trả về top-K.
- Loại khỏi danh sách: quán người dùng đã đánh giá (như notebook) và quán bị ẩn.

### 4.2 Cập nhật ngay khi có đánh giá mới

Khi có đánh giá mới: ghi vào CSDL, dựng lại đồ thị, chạy lại lan truyền, cập nhật các bảng đếm của tầng 2 (phổ biến, đồng ghé thăm). Không huấn luyện lại tham số nào.

Đồ thị nhỏ (khoảng 4.500 nút, 46.000 cạnh người dùng–quán) nên dự kiến chạy lại toàn bộ trong vài chục mili giây trên CPU. Con số này chưa đo; nếu thực tế chậm hơn 500 ms thì chỉ tính lại vector của người dùng vừa đánh giá.

### 4.3 Khởi đầu lạnh

| Tình huống | Cách xử lý |
|---|---|
| Người dùng mới, đã có ≥ 1 đánh giá | Thêm nút người dùng vào đồ thị với vector khởi tạo bằng 0; lan truyền cho nút này vector từ các quán đã đánh giá. Sau đó đi qua mô hình chính như mọi người dùng khác. |
| Người dùng mới, chưa có đánh giá | Mô hình đơn giản: điểm = khớp sở thích đã chọn lúc tạo (danh mục, mức giá, quận) + độ phổ biến gần đây. Không chọn sở thích thì chỉ dùng độ phổ biến gần đây. |
| Quán mới, chưa có đánh giá | Thêm nút quán với vector khởi tạo bằng 0; lan truyền cho nó vector từ các nút danh mục, mức giá, quận, đối tượng. Quán tham gia xếp hạng bình thường và có mục "Quán mới" riêng trên trang chủ, xếp theo điểm cá nhân hóa. |

- Nút mới không có vector tầng 0 nên trung bình các tầng của nó nhỏ hơn nút cũ. Với nút mới, lấy trung bình trên các tầng 1 trở đi để độ lớn so được với nút cũ.
- Tiêu chí tầng 2 của quán mới: số đánh giá và độ phổ biến bằng 0, điểm trung bình lấy theo trung bình toàn hệ thống, điểm khía cạnh để trống.
- Mỗi kết quả gợi ý trả kèm tên nhánh đã xử lý (`mo_hinh_chinh`, `nguoi_dung_moi_co_lich_su`, `nguoi_dung_moi_chua_co_lich_su`) để trang admin hiển thị.

### 4.4 Các danh sách khác

- **Quán tương tự** (trang chi tiết): cosine giữa vector quán của tầng 1.
- **Tìm kiếm và lọc**: lọc theo tên, quận, danh mục, mức giá, đang mở cửa; kết quả sắp theo điểm cá nhân hóa của người dùng đang chọn, hoặc theo điểm đánh giá.

## 5. Giao diện

Phong cách Foody: nền trắng, màu nhấn đỏ, thanh điều hướng trên cùng có ô tìm kiếm, lưới thẻ quán dày thông tin (ảnh, tên, địa chỉ, điểm, danh mục). Tên và logo riêng là FoodGo, không dùng logo Foody. Toàn bộ chữ trên giao diện bằng tiếng Việt. Dùng được trên máy tính và điện thoại.

Khi xây giao diện dùng skill `ui-ux-pro-max` để chọn hệ màu, cỡ chữ, thành phần, và `design-taste-frontend` để rà soát trước khi chốt.

**Phía người dùng**

| Trang | Nội dung |
|---|---|
| Trang chủ | "Gợi ý cho bạn", "Quán mới", duyệt theo quận và danh mục |
| Chọn người dùng | Danh sách người dùng có sẵn (tìm theo tên, kèm ảnh và số đánh giá), nút tạo người dùng mới. Người đang chọn hiện ở góc thanh điều hướng, lưu ở trình duyệt |
| Tạo người dùng | Nhập tên; chọn sở thích (danh mục, mức giá, quận), có thể bỏ qua |
| Tìm kiếm | Ô tìm, bộ lọc, sắp xếp, phân trang |
| Chi tiết quán | Ảnh, thông tin, giờ mở cửa, 5 điểm khía cạnh, bản đồ, danh sách đánh giá, "Quán tương tự", form viết đánh giá (điểm 1–10, tiêu đề, nội dung) |
| Hồ sơ | Thông tin người dùng, lịch sử đánh giá |

Chưa chọn người dùng thì trang chủ không có mục "Gợi ý cho bạn"; thay vào đó là lời mời chọn người dùng, bên dưới vẫn duyệt được quán theo quận và danh mục (sắp theo điểm đánh giá).

**Phía admin** (`/admin`, không đăng nhập)

| Trang | Nội dung |
|---|---|
| Tổng quan | Số người dùng, quán, đánh giá; đánh giá mới phát sinh; số người dùng và quán đang ở trạng thái lạnh |
| Quản lý quán | Danh sách có tìm kiếm; thêm, sửa, ẩn quán |
| Kiểm tra gợi ý | Chọn người dùng, xem danh sách gợi ý kèm nhánh xử lý, điểm tầng 1, điểm tầng 2 và giá trị từng tiêu chí của mỗi quán |

## 6. API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/api/users`, `/api/users/{id}` | Danh sách (tìm, phân trang), chi tiết kèm lịch sử |
| POST | `/api/users` | Tạo người dùng mới kèm sở thích |
| GET | `/api/places`, `/api/places/{id}` | Tìm và lọc, chi tiết |
| GET | `/api/places/{id}/reviews` | Đánh giá của quán |
| GET | `/api/places/{id}/similar` | Quán tương tự |
| POST | `/api/reviews` | Viết đánh giá, kích hoạt cập nhật gợi ý |
| GET | `/api/recommendations?user_id=&k=` | Gợi ý cá nhân hóa, kèm tên nhánh |
| GET | `/api/home?user_id=` | Các mục của trang chủ |
| GET | `/api/meta` | Danh sách quận, danh mục, mức giá |
| GET | `/api/admin/stats` | Số liệu tổng quan |
| POST, PUT | `/api/admin/places`, `/api/admin/places/{id}` | Thêm, sửa, ẩn quán |
| GET | `/api/admin/explain?user_id=` | Gợi ý kèm điểm từng tiêu chí |

## 7. Kiểm tra

- **Khớp vector:** lan truyền trên đồ thị gồm phần train và valid (đồ thị mà notebook dùng khi lưu vector) phải cho ra đúng `user_emb.npy` và `item_emb.npy` (sai số số học nhỏ).
- **Khớp chỉ số:** chạy toàn bộ đường gợi ý của backend trên tập test phải cho NDCG@20 ≈ 0,1277 và Recall@20 ≈ 0,2363 như notebook.
- **Cập nhật ngay:** sau một đánh giá mới, danh sách gợi ý của người đó thay đổi và quán vừa đánh giá biến mất khỏi danh sách.
- **Khởi đầu lạnh:** người dùng mới chưa có đánh giá nhận gợi ý từ mô hình đơn giản; sau đánh giá đầu tiên nhánh xử lý chuyển sang mô hình chính; quán admin vừa thêm xuất hiện ở mục "Quán mới".
- Kiểm tra tự động cho API chính; giao diện kiểm tra bằng cách chạy thật trên trình duyệt.

## 8. Lựa chọn kỹ thuật

Người dùng quyết định: FastAPI với uv; React, Tailwind, shadcn; thư mục con riêng; phong cách Foody, tên FoodGo; chọn hoặc tạo người dùng, không mật khẩu; chỉ đánh giá là tín hiệu; admin thêm quán.

Người viết thiết kế quyết định, có thể đổi:
- Tham số của GNN được xuất một lần từ `gnn_di_the.pt` sang file `.npz`; backend lan truyền bằng NumPy/SciPy nên không cần cài PyTorch để chạy.
- SQLite làm CSDL; ma trận và vector giữ trong bộ nhớ, nạp khi khởi động.
- Vite, TypeScript, React Router, TanStack Query ở frontend; Leaflet với bản đồ OpenStreetMap ở trang chi tiết.
- Toàn bộ đánh giá (kể cả valid, test) là lịch sử khi phục vụ.
- Đồng hồ hệ thống nối tiếp ngày cuối dữ liệu (mục 3).
- Người dùng mới chuyển sang mô hình chính ngay từ đánh giá đầu tiên.

Để người xây quyết định: tổ chức mã bên trong từng thư mục, lược đồ chi tiết của CSDL, thành phần shadcn cụ thể, cách phân trang.

## 9. Thứ tự xây

1. **Dữ liệu và lõi gợi ý:** script tạo CSDL; chuyển đồ thị, GNN, tiêu chí tầng 2 từ notebook sang backend; hai phép kiểm tra khớp ở mục 7 phải đạt trước khi làm tiếp.
2. **API:** người dùng, quán, đánh giá, gợi ý; cập nhật ngay sau đánh giá.
3. **Khởi đầu lạnh:** người dùng mới, quán mới, mô hình đơn giản.
4. **Giao diện người dùng:** hệ thiết kế, trang chủ, chọn và tạo người dùng, tìm kiếm, chi tiết quán, hồ sơ.
5. **Giao diện admin:** tổng quan, quản lý quán, kiểm tra gợi ý.
6. **Chạy thử toàn hệ thống** theo kịch bản demo và viết hướng dẫn chạy.
