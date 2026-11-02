# HoangNhuWedding — Firebase Google Admin

Dashboard: /admin.html. RSVP và lưu bút tiếp tục dùng Cloudflare Pages Functions + D1 (binding `DB`), không chuyển database sang Firebase.

## Thiết lập Firebase Authentication

1. Mở https://console.firebase.google.com/ rồi tạo/chọn Firebase project.
2. Vào Build > Authentication > Sign-in method, bật **Google**.
3. Project settings > Your apps > Web app: lấy cấu hình Web SDK và thay các trường trong `firebase-config.js` (apiKey, authDomain, projectId, appId). Đây là **client configuration**, không phải admin credential; có thể commit vào repo.
4. Authentication > Settings > Authorized domains: thêm domain `*.pages.dev` cụ thể và custom domain đang dùng.
5. Đăng nhập Google ở `/admin.html` lần đầu để Firebase tạo tài khoản. Trong Authentication > Users, tìm **User UID** tài khoản muốn làm admin.
6. Cloudflare Pages > Settings > Variables and Secrets: tạo `FIREBASE_PROJECT_ID` bằng projectId và `FIREBASE_ADMIN_UID` bằng UID ở bước 5. Deploy lại nếu cần.
7. Cloudflare Pages > Settings > Bindings: tạo D1 database binding tên `DB`. Chạy `schema.sql` trên D1 lần đầu nếu chưa tạo bảng.

Dashboard API kiểm tra chữ ký Firebase ID token, project, UID, thời gian và phương thức Google trước khi trả dữ liệu riêng tư. Không cần ADMIN_KEY nữa.

Lưu ý: đăng nhập bằng popup có thể bị chặn trong trình duyệt nhúng của một số ứng dụng. Hãy mở dashboard bằng Chrome hoặc Safari thông thường. Không gửi thông tin service account private key lên GitHub.
