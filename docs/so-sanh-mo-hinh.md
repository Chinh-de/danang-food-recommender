# Kế hoạch: so sánh các cơ chế gợi ý

## Mục tiêu

Cho cùng một người dùng, hiển thị gợi ý của **nhiều mô hình cạnh nhau** để thấy mỗi cơ chế gợi ý khác nhau ở đâu. Kèm theo là **kiểm tra trên quá khứ**: ẩn các quán người dùng đến gần đây nhất, xem mô hình nào đoán trúng. Mục đích là chứng minh bằng ví dụ cụ thể điều bảng kết quả trong báo cáo nói: mỗi thành phần thêm vào giúp được gì.

## Các mô hình đưa vào so sánh

Có hai nhóm.

### Nhóm A: mô hình gợi ý đơn giản, cổ điển

Các mô hình này không cần GPU hay PyTorch. Backend tính thẳng bằng NumPy/SciPy từ dữ liệu đánh giá, nên không phải huấn luyện trên Kaggle.

| Mô hình | Cơ chế | Cách tính |
|---|---|---|
| **Phổ biến** | Không cá nhân hóa | Quán nhiều đánh giá nhất mà người dùng chưa đến |
| **Gần vùng quen** | Chỉ dùng vị trí | Quán gần tâm các quán người dùng đã đến nhất, hòa thì xét điểm quán |
| **Dựa trên nội dung** (content-based) | Thuộc tính quán | Hồ sơ người dùng = trung bình vector thuộc tính các quán đã đến, có trọng số theo điểm (danh mục, mức giá, quận, đối tượng khách, 5 khía cạnh). Điểm = cosine giữa hồ sơ và vector quán |
| **Lọc cộng tác theo người dùng** (User-kNN CF) | "Người giống bạn đã đến" | Cosine giữa các người dùng trên ma trận người dùng–quán (giá trị là điểm). Lấy 50 người giống nhất, cộng điểm của họ cho từng quán theo độ giống |
| **Lọc cộng tác theo quán** (Item-kNN CF) | "Quán giống quán bạn đã đến" | Cosine giữa các quán theo người dùng đã đánh giá. Điểm của quán i = tổng độ giống của i với các quán người dùng đã đến, nhân điểm người dùng chấm |
| **Phân rã ma trận** (PureSVD) | Vector ẩn người dùng và quán, không có đồ thị | `scipy.sparse.linalg.svds` trên ma trận người dùng–quán (giá trị là điểm, không trừ trung bình, theo PureSVD của Cremonesi và cộng sự, 2010), 64 chiều (cùng số chiều GNN). Điểm = tích vô hướng |

Siêu tham số (k = 50 láng giềng cho User-kNN; Item-kNN dùng toàn bộ độ giống; 64 chiều) đặt trong `config.py`. Đây là cấu hình phổ biến, không tinh chỉnh riêng, và ghi rõ như vậy trên trang.

**Dữ liệu học:** ở chế độ kiểm tra quá khứ, các mô hình nhóm A học từ **train + valid**, tức được thấy nhiều dữ liệu hơn GNN (GNN chỉ học từ train). So sánh như vậy có lợi cho mô hình đơn giản, nên nếu mô hình đề xuất vẫn hơn thì kết luận càng chắc.

### Nhóm B: các mô hình GNN của đề tài

Đi từ baseline đến đầy đủ, mỗi mô hình thêm đúng một cơ chế so với mô hình trước. Thứ tự này giống bảng kết quả trong báo cáo.

| # | Mô hình | Cơ chế thêm vào | Tham số | NDCG@20 trên test (notebook) |
|---|---|---|---|---|
| 2 | **GCN** (baseline) | Lọc cộng tác trên đồ thị người dùng–quán, cạnh nhị phân | **Chưa lưu**, cần chạy lại notebook | 0,0734 |
| 3 | **GNN dị thể, nhị phân** | Thêm nút thuộc tính (danh mục, giá, tiện ích, quận, đối tượng khách) | `gnn_nhi_phan.pt` (đã có) | 0,0955 |
| 4 | **GNN dị thể, theo điểm** | Thêm mức hài lòng: w = r | `gnn_theo_diem.pt` (đã có) | 0,1066 |
| 5 | **GNN dị thể, động** (tầng 1) | Thêm độ mới: w = r·(0,2 + 0,8·e^(−Δt/180)) | `gnn_di_the.pt` (đã có, đang dùng) | 0,0976 |
| 6 | **Hai tầng đầy đủ** | Thêm xếp hạng lại 14 tiêu chí (khoảng cách, thời gian, đặc thù Đà Nẵng) | `ranker.txt` (đã có, đang dùng) | 0,1277 |

**Giai đoạn 1** làm ngay với toàn bộ nhóm A và các mô hình 3, 4, 5, 6 của nhóm B, vì không cần huấn luyện thêm hoặc tham số đã có sẵn.

**Giai đoạn 2** thêm GCN:
- Sửa ô cuối của `notebooks/foody_huan_luyen.ipynb` để lưu thêm `gcn.pt`, rồi chạy lại trên Kaggle.
- Seed đã cố định, nên kết quả phải khớp `results.csv`. Nếu không khớp, ghi lại sai lệch.
- Backend viết thêm phép lan truyền GCN bằng NumPy: H⁽ˡ⁺¹⁾ = ReLU(Â H⁽ˡ⁾ W⁽ˡ⁾), lớp cuối không có ReLU.

**Chưa đưa vào** hai biến thể tầng 2 "chỉ tiêu chí tĩnh" và "tĩnh + động": notebook chưa lưu hai bộ LightGBM này. Cần thì lưu cùng lúc với GCN ở giai đoạn 2.

## Trang "So sánh mô hình" (Admin, mục thứ 4)

Chọn một người dùng, rồi chọn một trong hai chế độ.

**Chọn mô hình để so sánh:** có 11 mô hình, quá nhiều để đặt cạnh nhau. Trên đầu trang có hàng chip để bật hoặc tắt từng mô hình, hiện tối đa 5 cột cùng lúc. Có 3 bộ chọn nhanh:
- **"Đơn giản và đề xuất":** Phổ biến, Item-kNN, MF, Hai tầng (mặc định).
- **"Lọc cộng tác và GNN":** User-kNN, Item-kNN, MF, GCN, Hai tầng.
- **"Các bước của đề tài":** GCN, Dị thể nhị phân, Dị thể theo điểm, Dị thể động, Hai tầng.

Bảng tổng ở cuối trang luôn có đủ 11 mô hình.

### Chế độ 1: Gợi ý hiện tại

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ So sánh mô hình   Người dùng [Nguyễn A ▾]   [Gợi ý hiện tại | Kiểm tra quá khứ]   Top [10 ▾] │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬────────────────┤
│ Phổ biến     │ GCN          │ Dị thể nhị   │ Dị thể điểm  │ Dị thể động  │ Hai tầng       │
│ ░ không dùng │ ▣ tương tác  │ ▣▣ +thuộc    │ ▣▣▣ +điểm    │ ▣▣▣▣ +thời   │ ▣▣▣▣▣ +khoảng  │
│   lịch sử    │              │    tính      │              │    gian      │   cách, ĐN     │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ 1 Bánh xèo ● │ 1 Mì Quảng ● │ …            │              │              │ 1 Mì Quảng ●   │
│ 2 …          │ …            │              │              │              │ …              │
├──────────────┼──────────────┼──────────────┼──────────────┼──────────────┼────────────────┤
│ km TB  3,4   │ 2,9          │ 2,1          │ …            │              │ 1,2            │
│ ngoài KV 40% │ …            │              │              │              │ 0%             │
│ khớp DM 20%  │ …            │              │              │              │ 70%            │
│ trùng với    │              │              │              │              │                │
│ hai tầng 1/10│ 3/10         │ 5/10         │ 6/10         │ 6/10         │ —              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴────────────────┘
          [Bản đồ: top-10 của mô hình đang chọn, vùng quen của người dùng tô mờ]
```

- **Mỗi cột** là top-K của một mô hình.
- **Đầu cột:** dải ô nhỏ cho biết mô hình dùng những thông tin nào: tương tác, thuộc tính, điểm, thời gian, khoảng cách, đặc thù Đà Nẵng. Nhìn là thấy mô hình sau hơn mô hình trước ở cơ chế nào.
- **Cùng một quán xuất hiện ở nhiều cột** được tô cùng màu khi rê chuột, để thấy thứ hạng thay đổi giữa các mô hình.
- **Chân cột** gồm các chỉ số mô tả, tính trên chính top-K đó:
  - khoảng cách trung bình tới vùng quen;
  - % gợi ý ngoài khu vực;
  - % khớp danh mục quen;
  - độ phổ biến trung bình;
  - số quán trùng với mô hình hai tầng.
- **Bản đồ** (dùng `PlaceMap` đã khóa trong Đà Nẵng): chọn một cột để xem top-K của mô hình đó trên bản đồ, kèm vùng quen của người dùng. Phần này thấy rõ nhất tác dụng của tiêu chí khoảng cách.
- **Mỗi quán trong cột 6** có nút "Vì sao gợi ý?" mở popup trực quan hóa ([truc-quan-hoa.md](truc-quan-hoa.md)).

### Chế độ 2: Kiểm tra quá khứ

Chỉ áp dụng cho người dùng gốc của Foody, vì người dùng tạo mới trên FoodGo không có tập test.

- **Đồ thị dùng để đoán:** train + valid, giống cách notebook đánh giá. Các quán người dùng đến trong tập test bị **ẩn**.
- **Đầu trang:** "Thực tế Nguyễn A đã đến tiếp: Quán X, Quán Y (ẩn khi đoán)".
- **Mỗi cột:** quán trúng được đánh dấu ✔. Chân cột hiện Recall@K, NDCG@K, HitRate@K của **riêng người dùng này**.
- **Nút "Chọn người dùng mà các mô hình khác nhau nhiều nhất":** tìm sẵn vài ví dụ đẹp cho buổi trình bày, ví dụ GCN không trúng quán nào còn mô hình hai tầng trúng 2 quán.
- **Bảng tổng ở cuối trang:** chỉ số trên toàn tập test (Recall, NDCG, HitRate, MRR @10/20/50, % ngoài khu vực), do backend **tính lại** cho từng mô hình theo đúng giao thức đánh giá của notebook.
  - **Nhóm B:** đặt cạnh số trong `results.csv`; dòng nào khớp có dấu ✔. Đây là bằng chứng các mô hình trên web đúng là các mô hình trong báo cáo.
  - **Nhóm A:** đây là số mới, chưa có trong báo cáo. Nếu kết quả đáng chú ý thì bổ sung vào báo cáo thành một bảng so sánh với các phương pháp cổ điển.

## Backend

| Việc | Nơi |
|---|---|
| Xuất `gnn_nhi_phan.pt`, `gnn_theo_diem.pt` (giai đoạn 2 thêm `gcn.pt`) sang `.npz` | `scripts/export_model.py` |
| `ModelZoo`: danh sách mô hình, mỗi mô hình có hàm `scores(user) -> điểm cho mọi quán` | `app/recsys/zoo.py` (mới) |
| Nhóm A: `fit(hist)` dựng ma trận thưa người dùng–quán, tính trước ma trận độ giống (quán–quán 1.698², người dùng–người dùng 2.696², vài chục MB float32) hoặc SVD; `scores(u)` chỉ còn nhân ma trận | `app/recsys/simple.py` (mới) |
| Vector của các mô hình phụ **chỉ tính khi trang so sánh cần**, rồi giữ đến lần ghi tiếp theo. Mô hình chính vẫn reload như cũ (~0,25 giây); mỗi mô hình phụ tốn thêm khoảng 0,25 giây ở lần mở trang đầu tiên | `engine.py` |
| Bộ vector cho chế độ quá khứ (đồ thị train + valid), tính một lần khi khởi động vì dữ liệu gốc không đổi | `loader.load_frames(conn, parts=...)` đã có |
| `GET /api/admin/compare?user_id=&mode=now\|holdout&k=10` → các cột, chỉ số mô tả, quán trúng | `api/admin.py` |
| `GET /api/admin/compare/summary` → chỉ số toàn tập test của từng mô hình, đặt cạnh `results.csv` (cache sau lần tính đầu) | `api/admin.py` |
| `GET /api/admin/compare/examples` → vài người dùng có kết quả khác nhau rõ giữa các mô hình | `api/admin.py` |

## Kiểm thử

- `scripts/check_notebook.py` mở rộng: NDCG@20 và Recall@20 trên test của mô hình 3, 4, 5 khớp `results.csv` (mô hình 6 đã khớp từ trước).
- `tests/test_simple.py`: mỗi mô hình nhóm A cho ví dụ nhỏ tính tay được (3 người dùng, 4 quán) ra đúng thứ tự mong đợi.
- `tests/test_compare.py`:
  - mô hình phổ biến không phụ thuộc người dùng;
  - các cột không chứa quán người dùng đã đến (chế độ hiện tại);
  - chế độ quá khứ không lộ tập test vào đồ thị.

## Các task

| # | Task | Ước lượng |
|---|---|---|
| C1 | Xuất tham số mô hình 3, 4; `zoo.py`; kiểm chứng khớp `results.csv` | nửa buổi |
| C1b | `simple.py`: 6 mô hình nhóm A, test tính tay, đo chỉ số trên tập test | 1 buổi |
| C2 | API so sánh (2 chế độ, chỉ số mô tả, bảng tổng, tìm ví dụ), test | 1 buổi |
| C3 | Trang "So sánh mô hình": chip chọn mô hình, các cột, dải cơ chế, tô quán trùng, chân cột, bản đồ, bảng tổng | 1 buổi |
| C4 | Giai đoạn 2: sửa notebook lưu `gcn.pt` (+ 2 bộ LightGBM nếu cần), chạy lại trên Kaggle, thêm GCN | nửa buổi + thời gian chạy Kaggle |

## Kịch bản demo (khoảng 2 phút)

1. Bộ chọn "Đơn giản và đề xuất": cùng một người dùng, phổ biến và lọc cộng tác so với mô hình hai tầng.
2. Bộ chọn "Các bước của đề tài", chế độ "Gợi ý hiện tại", người dùng có nhiều đánh giá. Đọc từ trái sang phải:
   - phổ biến giống nhau với mọi người;
   - GCN bắt đầu cá nhân hóa;
   - mô hình dị thể khớp danh mục hơn;
   - hai tầng gần vùng quen hơn (chỉ vào bản đồ và chỉ số km).
3. Chế độ "Kiểm tra quá khứ", bấm "Chọn ví dụ": thấy các quán thật được đánh dấu ✔ ở mô hình hai tầng nhưng trượt ở GCN.
4. Kéo xuống bảng tổng: đủ 11 mô hình: số tính lại trên web khớp số trong báo cáo.
