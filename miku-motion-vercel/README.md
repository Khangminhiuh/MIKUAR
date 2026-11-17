# Miku Motion
1. Giải nén ZIP. Đưa toàn bộ nội dung vào repo GitHub riêng dành cho Miku Motion. Trong thư mục gốc của repo cần thấy index.html và vercel.json.
2. Mở https://vercel.com/new và Import repo. Chọn Other, Root Directory ./, giữ Build Command mặc định. Nếu repo chứa thêm thư mục bao ngoài, chọn thư mục có index.html làm Root Directory.
3. Bấm Deploy rồi Visit. Cho phép camera khi bấm bật. Ứng dụng chạy trên HTTPS. Không cần cơ sở dữ liệu hoặc biến môi trường.
## Mã nguồn
- index.html và app.js: hiệu ứng khuôn mặt và các ngón tay. Chế độ này tải MediaPipe và mô hình từ Internet.
- surface.html và surface.js: đặt Miku lên bề mặt bằng WebXR hit-test trên thiết bị tương thích.
- webcam.html, webcam.js và patches.mjs: đặt Miku và theo dõi chi tiết hình ảnh bằng webcam.
- style.css và miku-stand.webp: giao diện và ảnh Miku.
