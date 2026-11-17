# FoodGo

Trang khám phá quán ăn Đà Nẵng chạy mô hình gợi ý đã huấn luyện trên dữ liệu Foody: GNN dị thể với trọng số cạnh động (tầng 1) và xếp hạng lại bằng LightGBM LambdaRank (tầng 2). Gợi ý cập nhật ngay sau mỗi đánh giá, không huấn luyện lại. Người dùng mới và quán mới được xử lý bằng nhánh khởi đầu lạnh.

Thiết kế: [docs/thiet-ke.md](docs/thiet-ke.md) · Kế hoạch: [docs/ke-hoach.md](docs/ke-hoach.md) · Hệ thiết kế giao diện: [docs/he-thiet-ke.md](docs/he-thiet-ke.md)

## Yêu cầu

- [uv](https://docs.astral.sh/uv/) (backend, Python 3.12 do uv tự cài)
- Node.js 20 trở lên (frontend)

## Chuẩn bị (một lần)

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
uv run pytest                      # 32 test: dữ liệu, GNN, tầng 2, engine, khởi đầu lạnh, API
uv run scripts/check_notebook.py   # chỉ số trên tập test phải khớp notebook: NDCG@20 0,1277, Recall@20 0,2363
```

## Kịch bản demo

1. **Gợi ý cá nhân hóa.** Bấm "Chọn người dùng", chọn một người có nhiều đánh giá. Trang chủ hiện "Gợi ý cho …" (mô hình chính) và "Ghé lại quán quen".
2. **Cập nhật ngay.** Mở một quán trong danh sách gợi ý, chấm điểm và gửi đánh giá. Về trang chủ: quán vừa đánh giá rời khỏi danh sách và thứ tự gợi ý thay đổi.
3. **Người dùng mới.** "Tạo người dùng mới", chọn vài danh mục và quận. Gợi ý ban đầu đến từ mô hình đơn giản (phổ biến + sở thích). Viết một đánh giá: người dùng chuyển sang GNN dị thể + xếp hạng lại.
4. **Quán mới.** Vào Admin, "Thêm quán", chọn danh mục, giá, quận, vị trí. Quán xuất hiện ở mục "Quán mới" trên trang chủ, xếp theo mức phù hợp với người đang chọn.
5. **Giải thích gợi ý.** Admin, "Kiểm tra gợi ý": chọn người dùng ở bước 1 và bước 3 để so sánh nhánh xử lý, điểm GNN, điểm tầng 2 và 14 tiêu chí của từng quán.

## Cấu trúc

```
backend/
  app/recsys/   catalog (ma trận thuộc tính), graph (đồ thị dị thể, trọng số động), propagate (lan truyền GNN),
                features (14 tiêu chí tầng 2 + LightGBM), cold (mô hình đơn giản), engine (trạng thái phục vụ)
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
