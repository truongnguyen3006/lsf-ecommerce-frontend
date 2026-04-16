# Ecommerce Frontend

Frontend này là giao diện demo cho consumer project ecommerce khi tích hợp với **LSF**. Mục tiêu chính không phải xây một website thương mại điện tử đầy đủ tính năng, mà là giúp trình bày rõ luồng `order -> inventory -> payment -> notification` và mở các bề mặt quan sát framework trong lúc demo.

## Vai trò của repo này trong bài toán luận văn

- cung cấp storefront đủ dùng để tạo đơn hàng thật
- hiển thị trạng thái đơn hàng theo thời gian thực qua WebSocket
- cung cấp khu vực admin để quan sát availability, outbox recent và các quick links vận hành
- làm bề mặt trình diễn cho việc `order-service` hiện mặc định chạy `LSF_SAGA` ở môi trường demo

## Chức năng chính

### Khách hàng

- Xem danh sách sản phẩm và lọc theo từ khóa, danh mục
- Xem chi tiết sản phẩm, chọn màu, size và kiểm tra tồn kho theo biến thể
- Đăng ký, đăng nhập tài khoản
- Thêm sản phẩm vào giỏ hàng, chỉnh số lượng và đặt hàng
- Theo dõi trạng thái đơn hàng qua trang đơn hàng và màn hình chờ xử lý
- Nhận cập nhật trạng thái đơn hàng theo thời gian thực qua WebSocket
- Xem và cập nhật hồ sơ cá nhân

### Admin

- Xem danh sách sản phẩm, đơn hàng và người dùng
- Tạo sản phẩm mới và quản lý biến thể
- Khóa hoặc mở khóa tài khoản người dùng
- Mở màn **Framework Evidence** để phục vụ demo LSF

## Framework Evidence

Khu vực admin có thêm một màn riêng để phục vụ demo framework:

- tra cứu availability theo SKU
- xem recent outbox events
- lọc nhanh theo `orderNumber` hoặc `msgKey`
- mở nhanh Grafana, Zipkin, phpMyAdmin, outbox admin, Kafka admin và saga evidence qua backend

Phần này giúp frontend không chỉ là nơi tạo đơn, mà còn là nơi đối chiếu bằng chứng tích hợp framework.

## Cấu trúc chính

```text
src/
├─ app/                # các trang chính
├─ components/         # component giao diện
├─ services/           # gọi API
├─ lib/                # axios, helper, auth, order status
├─ store/              # state management
├─ constants/          # quick links hệ thống
└─ types/              # kiểu dữ liệu
```

## Yêu cầu môi trường

- Node.js 20+
- npm 10+
- Backend API sẵn sàng qua `http://localhost:8000`
- WebSocket server tại `http://localhost:8087/ws`

## Cách chạy local

### 1. Bảo đảm backend đã chạy trước

Repo frontend phụ thuộc trực tiếp vào:

- repo framework: `D:\IdeaProjects\lsf-parent-fixed`
- repo backend consumer: `D:\IdeaProjects\ecommerce-backend`

Trước khi chạy frontend, nên:

1. `mvn clean install` ở repo framework
2. `docker compose up -d` ở backend
3. khởi động backend service theo đúng startup order

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo file môi trường

Tạo file `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=http://localhost:8087/ws
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3000
NEXT_PUBLIC_ZIPKIN_URL=http://localhost:9411
NEXT_PUBLIC_PHPMYADMIN_URL=http://localhost:8888
NEXT_PUBLIC_OUTBOX_ADMIN_URL=http://localhost:8000/admin/outbox
```

### 4. Chạy frontend

```bash
npm run dev
```

Frontend mặc định chạy tại:

- `http://localhost:3001`

## Startup order phía backend nên đi kèm khi demo

1. `discovery-server`
2. `api-gateway`
3. `user-service`
4. `product-service`
5. `inventory-service`
6. `order-service`
7. `payment-service`
8. `cart-service`
9. `notification-service`

## Tài khoản mẫu cho demo

- Admin để mở khu vực quản trị/evidence:
  - `username`: `admin`
  - `password`: `admin123456@`
- Để demo storefront và checkout mượt hơn, nên đăng ký một tài khoản user thường riêng trên giao diện.

## Các URL chính

- Frontend: `http://localhost:3001`
- Entry API qua Nginx: `http://localhost:8000`
- WebSocket: `http://localhost:8087/ws`
- Keycloak: `http://localhost:8085`
- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Zipkin: `http://localhost:9411`
- phpMyAdmin: `http://localhost:8888`

## Kịch bản demo tương ứng

### 1. Happy path

- đăng nhập user thường
- thêm sản phẩm vào giỏ
- checkout
- theo dõi realtime trên màn hình chờ và trang đơn hàng
- đăng nhập admin để đối chiếu evidence

### 2. Failure / compensation

- chạy luồng gây payment failure hoặc release reservation
- dùng frontend để quan sát status đơn hàng
- dùng màn admin framework để đối chiếu event và availability

### 3. Timeout / overdue

- sau khi chạy tải từ backend/JMeter, mở admin evidence để đối chiếu runtime cùng dashboard ngoài

### 4. Recovery after restart

- giữ màn hình waiting hoặc orders để quan sát đơn hàng trước và sau khi `order-service` khởi động lại

### 5. Anti-oversell / burst traffic

- dùng frontend như bề mặt kiểm tra số lượng đơn thành công, trạng thái availability và liên kết tới dashboard

## Tài liệu nên đọc kèm

Khi trình bày demo, nên mở song song README và evidence docs của backend consumer, đặc biệt các file:

- `docs/LSF_INTEGRATION_TRACEABILITY.md`
- `docs/LSF_PHASE3_OPERATIONS_VISIBILITY.md`
- `docs/LSF_PHASE8_DEFAULT_ON_SAGA_CUTOVER.md`

## Giới hạn hiện tại

- Chưa phải website thương mại điện tử hoàn chỉnh theo hướng production.
- Giao diện hiện được giữ ở mức đủ tốt để phục vụ checkout flow và phần demo framework.
- Một số quick links evidence phụ thuộc backend và hạ tầng quan sát đang chạy.
- Frontend chưa có automated UI test riêng; giá trị chính của repo nằm ở khả năng hỗ trợ demo và đối chiếu evidence.
- Trọng tâm đóng góp của đề tài vẫn nằm ở framework LSF và consumer integration phía backend.

## Tác giả

- **Tên:** Nguyễn Lâm Trường
- **Email:** lamtruongnguyen2004@gmail.com
- **GitHub:** [https://github.com/truongnguyen3006](https://github.com/truongnguyen3006)
