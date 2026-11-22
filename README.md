# FoodGo

Trang khám phá quán ăn Đà Nẵng chạy mô hình gợi ý đã huấn luyện trên dữ liệu Foody: GNN dị thể với trọng số cạnh động (tầng 1) và xếp hạng lại bằng LightGBM LambdaRank (tầng 2). Gợi ý cập nhật ngay sau mỗi đánh giá, không huấn luyện lại. Người dùng mới và quán mới được xử lý bằng nhánh khởi đầu lạnh.

Thiết kế: [docs/thiet-ke.md](docs/thiet-ke.md) · Kế hoạch: [docs/ke-hoach.md](docs/ke-hoach.md) · Hệ thiết kế giao diện: [docs/he-thiet-ke.md](docs/he-thiet-ke.md)

## Chức năng

### Người dùng

**Chọn hoặc tạo người dùng.** Không cần mật khẩu. Chọn một trong 2.696 người dùng thật của Foody Đà Nẵng, hoặc tạo người dùng mới kèm sở thích (danh mục, mức giá, quận). Có thể bỏ qua phần sở thích.

| Chọn người dùng có sẵn | Tạo người dùng mới |
|---|---|
| ![Chọn người dùng](docs/anh/demo_02_chon_nguoi_dung.png) | ![Tạo người dùng mới](docs/anh/demo_06_tao_nguoi_dung.png) |

**Trang chủ** gồm các mục:
- **Gợi ý cho bạn:** 20 quán người dùng chưa đến, do GNN dị thể và tầng xếp hạng lại LightGBM chọn.
- **Ghé lại quán quen:** quán đã chấm từ 7 điểm trở lên.
- **Quán mới:** quán admin vừa thêm.
- **Duyệt theo quận và danh mục.**

Chưa chọn người dùng thì trang chủ chỉ có lời mời chọn người dùng và phần duyệt quán.

| Chưa chọn người dùng | Gợi ý cá nhân hóa |
|---|---|
| ![Trang chủ chưa chọn người dùng](docs/anh/demo_01_trang_chu_chua_chon.png) | ![Gợi ý cá nhân hóa](docs/anh/demo_03_goi_y_ca_nhan.png) |

**Người dùng mới (khởi đầu lạnh).** Khi chưa có đánh giá nào, gợi ý dựa trên độ phổ biến và sở thích đã chọn. Ở ảnh dưới, người dùng chọn Café/Dessert, Món Hàn và Quận Hải Châu. Ngay sau đánh giá đầu tiên, người dùng được đưa vào đồ thị và nhận gợi ý từ mô hình chính.

![Gợi ý cho người dùng mới](docs/anh/demo_07_goi_y_nguoi_moi.png)

**Tìm kiếm cá nhân hóa:**
- Tìm theo tên hoặc địa chỉ, gõ không dấu vẫn được.
- Lọc theo quận, danh mục, mức giá, đang mở cửa.
- Mặc định xếp "Phù hợp với bạn" bằng **cả hai tầng**, giống "Gợi ý cho bạn": tầng 1, rồi 14 tiêu chí và LightGBM trên đúng tập quán khớp. Hai người gõ cùng "pizza" thấy cùng các quán nhưng thứ tự khác nhau. Người dùng mới chưa có đánh giá được xếp bằng mô hình đơn giản.
- Các lựa chọn sắp xếp khác: điểm, số đánh giá.

![Tìm kiếm cá nhân hóa](docs/anh/demo_15_tim_kiem_ca_nhan.png)

**"Vì sao gợi ý?": trực quan hóa từng bước.** Nút này có trên thẻ quán ở "Gợi ý cho bạn", trên kết quả tìm kiếm và trên trang chi tiết quán. Bấm vào sẽ mở popup đi qua 12 bước tính của mô hình cho đúng cặp người dùng–quán:
1. dữ liệu thô;
2. số hóa thành nút đồ thị;
3. trọng số cạnh động;
4. chuẩn hóa Â;
5. E⁽⁰⁾;
6–8. lan truyền 3 lớp (đóng góp theo từng quan hệ × α);
9. điểm tầng 1 và thứ hạng;
10. 14 tiêu chí;
11. đóng góp của từng tiêu chí vào điểm LightGBM;
12. thứ hạng cuối.

Mở từ trang tìm kiếm thì popup có thêm bước "Khớp từ khóa".

Mọi số là số thật của engine. Bước nào có kết quả thì có dòng **kiểm chứng**: tính lại từ các thành phần, so với giá trị engine đang dùng, kèm sai số. Popup dùng phím ← →, có chế độ tự chạy, và dùng được trên điện thoại. Chi tiết: [docs/truc-quan-hoa.md](docs/truc-quan-hoa.md).

- **Cột luồng** bên trái: mỗi bước ghi giá trị nó tính ra; các bước cấp dữ liệu cho bước đang xem được tô xanh. Mỗi bước ghi rõ đầu vào lấy từ bước nào và đầu ra chuyển sang bước nào.
- **Chọn mô hình gợi ý** cạnh tiêu đề "Gợi ý cho bạn" (và cạnh ô sắp xếp "Phù hợp với bạn" ở trang tìm kiếm): danh sách gợi ý và thứ tự kết quả tìm kiếm đổi theo mô hình đang chọn; mặc định là mô hình đề xuất hai tầng. Lựa chọn được nhớ trên trình duyệt; popup mở với đúng mô hình này.
- **Nút chuyển mô hình** ở đầu popup: xem cùng cặp người dùng–quán qua Phổ biến, Gần vùng quen, Dựa trên nội dung, User-kNN, Item-kNN, PureSVD, GCN và ba biến thể GNN dị thể. Bước cuối của mỗi mô hình cho top-K trùng với cột của mô hình đó ở trang So sánh mô hình.

| Lan truyền một lớp | Đóng góp từng tiêu chí (LightGBM) | Thứ hạng cuối | User-kNN |
|---|---|---|---|
| ![Lan truyền](docs/anh/demo_16_vi_sao_lan_truyen.png) | ![LightGBM](docs/anh/demo_17_vi_sao_lightgbm.png) | ![Kết quả](docs/anh/demo_18_vi_sao_ket_qua.png) | ![User-kNN](docs/anh/demo_20_vi_sao_user_knn.png) |

**Chi tiết quán:**
- Ảnh, giờ mở cửa, khoảng giá, 5 điểm khía cạnh, bản đồ OpenStreetMap, danh sách đánh giá.
- Mục "Quán tương tự", tính theo embedding GNN.
- Form viết đánh giá (1–10 điểm). Gửi xong, gợi ý của người dùng cập nhật ngay (khoảng 0,25 giây), không huấn luyện lại.

| Tìm kiếm và lọc | Chi tiết quán, viết đánh giá |
|---|---|
| ![Tìm kiếm](docs/anh/demo_05_tim_kiem.png) | ![Chi tiết quán](docs/anh/demo_04_chi_tiet_quan.png) |

Giao diện dùng được trên điện thoại:

<img src="docs/anh/demo_14_dien_thoai.png" alt="Giao diện điện thoại" width="280">

### Admin (`/admin`)

- **Tổng quan:** số người dùng, quán, đánh giá; số phát sinh trên FoodGo; số người dùng và quán đang ở trạng thái lạnh; thời gian cập nhật mô hình.
- **Quản lý quán:** thêm, sửa, ẩn quán. Quán mới chưa có đánh giá vẫn được gợi ý ngay, vì nó được nối với các nút danh mục, mức giá, quận và đối tượng khách trong đồ thị.
- **Kiểm tra gợi ý:** với một người dùng, xem nhánh xử lý (mô hình chính hay mô hình đơn giản), điểm GNN, điểm tầng 2 và giá trị 14 tiêu chí của từng quán được gợi ý.
- **So sánh mô hình** ([docs/so-sanh-mo-hinh.md](docs/so-sanh-mo-hinh.md)): 11 mô hình, chọn tối đa 5 cột đặt cạnh nhau.
  - **Nhóm A, cổ điển:** phổ biến, gần vùng quen, dựa trên nội dung, User-kNN, Item-kNN, PureSVD.
  - **Nhóm B, GNN của đề tài:** GCN, dị thể nhị phân / theo điểm / động, hai tầng.
  - **Chế độ "Gợi ý hiện tại":** chỉ số mô tả từng cột (cách vùng quen, ngoài vùng quen, khớp danh mục, độ phổ biến, trùng với hai tầng) và bản đồ.
  - **Chế độ "Kiểm tra quá khứ":** ẩn tập test, đánh dấu ✔ quán mỗi mô hình đoán trúng.
  - **Bảng tổng:** tính lại trên toàn tập test. Các mô hình nhóm B khớp đúng số trong báo cáo (có dấu ✔).
  - **GCN cần thêm `artifacts/gcn.npz`:** chạy lại `notebooks/foody_huan_luyen.ipynb` trên Kaggle (ô cuối đã lưu thêm `gcn.pt`), rồi chạy lại `scripts/export_model.py`.

![So sánh mô hình](docs/anh/demo_19_so_sanh_mo_hinh.png)

| Tổng quan | Thêm quán |
|---|---|
| ![Admin tổng quan](docs/anh/demo_13_admin_tong_quan.png) | ![Thêm quán](docs/anh/demo_11_them_quan.png) |

| Quán mới xuất hiện trên trang chủ | Kiểm tra gợi ý (mô hình chính) |
|---|---|
| ![Quán mới](docs/anh/demo_12_quan_moi.png) | ![Kiểm tra gợi ý](docs/anh/demo_10_kiem_tra_mo_hinh_chinh.png) |

| Người dùng mới chưa có đánh giá | Sau đánh giá đầu tiên |
|---|---|
| ![Người dùng mới](docs/anh/demo_08_kiem_tra_nguoi_moi.png) | ![Sau đánh giá đầu tiên](docs/anh/demo_09_kiem_tra_sau_danh_gia.png) |

## Yêu cầu

- [uv](https://docs.astral.sh/uv/) (backend, Python 3.12 do uv tự cài)
- Node.js 20 trở lên (frontend)

## Chuẩn bị (một lần)

* [ ] 
  ```bash
  cd foodgo/backend
  uv sync
  # copy file mô hình từ notebooks/ket_qua_chay và xuất tham số GNN sang .npz (cần torch, chỉ dùng ở bước này)
  uv run --with torch --extra-index-url https://download.pytorch.org/whl/cpu scripts/export_model.py
  # tạo data/foodgo.db từ data/foody_processed và file crawl trong foody/
  uv run scripts/prepare_data.py

  cd ../frontend
  npm install
  ```

## Chạy

Hai cửa sổ dòng lệnh:

```bash
cd foodgo/backend && uv run uvicorn app.main:app --port 8000
cd foodgo/frontend && npm run dev
```

Mở http://localhost:5173 (trang chính) và http://localhost:5173/admin (quản trị). Tài liệu API: http://localhost:8000/docs.

## Trước buổi demo

Tạo lại DB sạch để xóa người dùng, quán và đánh giá thử nghiệm, rồi khởi động lại backend:

```bash
cd foodgo/backend && uv run scripts/prepare_data.py
```

## Kiểm tra

```bash
cd foodgo/backend
uv run pytest                      # 60 test: dữ liệu, GNN, tầng 2, engine, khởi đầu lạnh, API, tìm kiếm, trực quan hóa, so sánh mô hình
uv run scripts/check_notebook.py   # chỉ số trên tập test phải khớp notebook: NDCG@20 0,1277, Recall@20 0,2363
```

## Kịch bản demo

1. **Gợi ý cá nhân hóa.** Bấm "Chọn người dùng", chọn một người có nhiều đánh giá. Trang chủ hiện "Gợi ý cho …" (mô hình chính) và "Ghé lại quán quen".
2. **Cập nhật ngay.** Mở một quán trong danh sách gợi ý, chấm điểm và gửi đánh giá. Về trang chủ: quán vừa đánh giá rời khỏi danh sách và thứ tự gợi ý thay đổi.
3. **Người dùng mới.** "Tạo người dùng mới", chọn vài danh mục và quận. Gợi ý ban đầu đến từ mô hình đơn giản (phổ biến + sở thích). Viết một đánh giá: người dùng chuyển sang GNN dị thể + xếp hạng lại.
4. **Quán mới.** Vào Admin, "Thêm quán", chọn danh mục, giá, quận, vị trí. Quán xuất hiện ở mục "Quán mới" trên trang chủ, xếp theo mức phù hợp với người đang chọn.
5. **Giải thích gợi ý.** Admin, "Kiểm tra gợi ý": chọn người dùng ở bước 1 và bước 3 để so sánh nhánh xử lý, điểm GNN, điểm tầng 2 và 14 tiêu chí của từng quán.
6. **Vì sao gợi ý?** Trên một thẻ trong "Gợi ý cho bạn", bấm "Vì sao gợi ý?", rồi đi qua 12 bước bằng phím →. Chỉ vào các dòng kiểm chứng. Bước 12 cho thứ hạng trùng với vị trí trên trang chủ.
7. **Tìm kiếm cá nhân hóa.** Gõ "pizza" với người dùng A, đổi sang người dùng B: cùng các quán, thứ tự khác.
8. **So sánh mô hình.** Admin, "So sánh mô hình":
   - chế độ "Kiểm tra quá khứ", bấm một tên trong "Ví dụ…" để thấy hai tầng đoán trúng, các mô hình khác trượt;
   - kéo xuống bảng tổng: các mô hình nhóm B khớp đúng số trong báo cáo.

## Cấu trúc

```
backend/
  app/recsys/   catalog (ma trận thuộc tính), graph (đồ thị dị thể, trọng số động), propagate (lan truyền GNN),
                features (14 tiêu chí tầng 2 + LightGBM), cold (mô hình đơn giản), engine (trạng thái phục vụ),
                trace (từng bước tính cho popup "Vì sao gợi ý?"), zoo + compare (các mô hình so sánh)
  app/api/      public (người dùng), admin
  scripts/      export_model, prepare_data, check_notebook
frontend/src/
  pages/        Home, Users, NewUser, Search, PlaceDetail, Profile, admin/*
  components/   thẻ quán, lưới, đánh giá, bản đồ, header
artifacts/      tham số mô hình (gnn.npz, ranker.txt, train_meta.json)
data/           foodgo.db
```

## Ghi chú kỹ thuật

- Backend không cần PyTorch khi chạy: tham số embedding được xuất sang `artifacts/gnn.npz`, lan truyền làm bằng SciPy. Vector tính ra khớp vector notebook đã lưu (sai số < 1e-4).
- Mỗi lần ghi (đánh giá, người dùng, quán), backend dựng lại đồ thị và lan truyền lại toàn bộ, mất khoảng 0,25 giây.
- Đồng hồ hệ thống nối tiếp ngày cuối dữ liệu (12/07/2024) để trọng số thời gian và độ phổ biến gần đây có nghĩa. Đồng hồ này chỉ dùng trong backend; giao diện hiển thị ngày giờ thật.
