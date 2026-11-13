# SeSide SW-0002 dashboard

Trang HTML/CSS/JavaScript tĩnh đọc dashboard trực tiếp từ Supabase. Không dùng backend riêng; đăng nhập và phân quyền được xử lý bằng Supabase Auth và một RPC bị giới hạn bởi bảng `demo_patient_access`. Mã `SW-0002` chỉ dùng nội bộ để truy vấn; giao diện hiển thị tên thân thiện của thiết bị.

Chỉ tài khoản Auth được gán rõ ràng cho thiết bị `SW-0002` mới nhận được dữ liệu. Trang hiển thị tối đa 3 cảnh báo mới nhất, telemetry nhịp tim trong 24 giờ và các trường cần thiết của hồ sơ/thiết bị. Không truy vấn trực tiếp các bảng dữ liệu từ trình duyệt.

## Cấu hình Supabase

1. Tạo một tài khoản người xem tại **Supabase Dashboard → Authentication → Users → Add user**. Không bật đăng ký công khai cho trang demo.
2. Nếu các bảng SafeWatch chưa tồn tại, chạy toàn bộ `../web/scripts/supabase_schema.sql` trong Supabase SQL Editor.
3. Chạy toàn bộ `secure_supabase.sql` trong SQL Editor **của cùng project Supabase mà trang đang dùng**. Migration tạo RPC `get_sw0002_dashboard()`, cấp quyền Auth cho RPC, giữ các bảng nhạy cảm ở chế độ không đọc trực tiếp, lấy GPS từ telemetry mới nhất nếu có, và nạp lại schema cache PostgREST. Nếu trước đây đã chạy migration SW-002 cũ, script sẽ chuyển ánh xạ quyền sang SW-0002.
4. Sao chép UUID của tài khoản Auth vừa tạo. Trong SQL Editor, cấp quyền xem đúng bệnh nhân:

   ```sql
   insert into public.demo_patient_access (auth_user_id, patient_id, active)
   values ('<UUID_TAI_KHOAN_AUTH>', 'SW-0002', true)
   on conflict (auth_user_id, patient_id)
   do update set active = excluded.active;
   ```

   Để thu hồi quyền, đặt `active = false` hoặc xóa đúng bản ghi ánh xạ.
5. Đảm bảo `.env` tại `web/.env` có `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`. Tạo `config.js` trong thư mục này từ đúng hai biến đó, ví dụ:

   ```js
   window.SAFEWATCH_CONFIG = Object.freeze({
     url: "https://<project-ref>.supabase.co",
     publishableKey: "<publishable-key>",
   });
   ```

   Chỉ publishable key được phép có trong JavaScript công khai. **Không dùng `SUPABASE_SECRET_KEY`, `service_role`, mật khẩu, hay khóa thiết bị ở frontend.** Publishable key không thay thế RLS; migration chỉ cho RPC trả dữ liệu khi Auth user có ánh xạ đang hoạt động.
6. Hard refresh trang Live Server (Ctrl+Shift+R), đăng nhập lại bằng email/mật khẩu Supabase Auth và tài khoản có UUID đã được cấp quyền. Nếu trước khi chạy migration trình duyệt đã báo `Could not find the function ... in the schema cache`, chạy lại file SQL, đợi migration thành công rồi tải lại trang. Nếu vẫn gặp thông báo đó, chạy `notify pgrst, 'reload schema';` trong SQL Editor và tải lại trang sau vài giây.

`SW-0002` là **mã thiết bị**, không nhất thiết là mã bệnh nhân. RPC tìm bản ghi `users` có `data.deviceId = 'SW-0002'` (hoặc `users.id = 'SW-0002'`), rồi tìm thiết bị gắn với người đó qua `devices.data.userId` hay `users.data.deviceId`. Schema seed hiện tại trong repository dùng người dùng `USR-002`, gắn với thiết bị `SW-0002`. Các mã này chỉ dùng nội bộ; giao diện hiển thị tên thân thiện. Nếu bản ghi thiết bị có trường `name` hoặc `deviceName`, trang dùng tên đó; nếu không, trang tạo tên hiển thị từ tên người bệnh.

## Vị trí GPS

Backend hiện đã lưu `latitude`/`longitude` trong telemetry khi thiết bị gửi các trường đó, đồng thời cập nhật vị trí mới nhất của thiết bị. RPC đọc tọa độ GPS mới nhất từ `telemetry_records`, hoặc dùng tọa độ đã lưu trong bản ghi thiết bị. Nếu database chưa có tọa độ, bản đồ trên trang vẫn là **minh họa**, hiện thông báo chưa có GPS và không đặt ghim hay giả lập vị trí.

Firmware ESP32 hiện tại chỉ gửi nhịp tim, SpO₂, pin và trạng thái kết nối; chưa gửi tọa độ GPS. Vì vậy, để có vị trí thật, cần thiết bị/module GPS được cấu hình lấy fix rồi gửi `latitude` và `longitude` trong payload telemetry. Không dùng vị trí GPS của trình duyệt giám sát làm vị trí của đồng hồ/bệnh nhân. Khi có tọa độ, bản đồ vệ tinh Leaflet tải ảnh từ Esri World Imagery và hiển thị attribution của nhà cung cấp; sử dụng theo [điều khoản Esri](https://www.esri.com/en-us/legal/terms/data-attributions). Tọa độ trong yêu cầu tải ảnh bản đồ được gửi tới Esri; mở liên kết Google Maps cũng gửi tọa độ cho Google.

Ngày giờ dưới lời chào là thời điểm telemetry mới nhất trong database, không phải giờ hiện tại của máy đang mở trang. Nếu thiết bị chưa từng gửi telemetry, giao diện báo chưa có dữ liệu cập nhật.

Nếu RPC báo không tìm thấy thiết bị, kiểm tra trong SQL Editor:

```sql
select id, data->>'deviceId' as device_id
from public.users
where lower(data->>'deviceId') = lower('SW-0002');

select id, data->>'userId' as user_id
from public.devices
where lower(id) = lower('SW-0002');
```

Phải có bản ghi người dùng liên kết với `SW-0002` và bản ghi thiết bị đó trong **project đang được trang cấu hình**. Không thay bằng `SW-0002` nếu mã đó không đúng bệnh nhân cần xem.

## Chạy thử

Mở trang qua HTTP (không mở trực tiếp bằng `file://`):

```bash
cd demo_sw002
python3 -m http.server 8000
```

Mở <http://localhost:8000>, rồi đăng nhập bằng tài khoản Supabase Auth đã được gán quyền.

## GitHub Pages

GitHub Pages là host tĩnh: các tệp JavaScript và publishable key đều công khai. Có thể đặt thư mục này làm thư mục xuất bản hoặc dùng GitHub Actions để publish riêng `demo_sw002`. Không đưa `SUPABASE_SECRET_KEY` vào repository, GitHub Pages hay workflow xuất bản.

Trước khi chia sẻ trang, tạo tài khoản Auth riêng cho người xem được phép, giới hạn quyền của tài khoản trong `demo_patient_access`, và xác nhận `secure_supabase.sql` đã chạy. Khi đăng nhập và có GPS hợp lệ, bản đồ vệ tinh tải ảnh trực tiếp từ Esri; tọa độ được gửi tới máy chủ Esri trong các yêu cầu tải ảnh.

Trang này hiển thị dữ liệu sức khỏe và vị trí nhạy cảm. Chỉ triển khai nếu người xem được cấp quyền và việc xử lý/chia sẻ dữ liệu đã được cho phép phù hợp.
