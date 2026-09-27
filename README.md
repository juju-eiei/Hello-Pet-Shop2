# 🐾 Hello Pet Shop 2 (ระบบบริหารจัดการร้านจำหน่ายสินค้าและบริการสัตว์เลี้ยง)

ระบบบริหารจัดการร้านจำหน่ายสินค้าและบริการสัตว์เลี้ยงแบบครบวงจร (Web Application) ครอบคลุมทั้งระบบหน้าร้าน (E-commerce / Storefront), ระบบแคชเชียร์ขายหน้าร้าน (POS), และระบบหลังร้านสำหรับพนักงานและผู้ดูแลระบบ (Admin / Staff Backoffice)

---

## 🌟 ฟังก์ชันหลักของระบบ (Features)

### 🛒 1. ฝั่งลูกค้า (Customer & Storefront)
- **ระบบสินค้าและค้นหา:** เลือกดูสินค้าตามหมวดหมู่ ค้นหา กรองตามประเภทสัตว์เลี้ยง
- **ระบบสมาชิกและสัตว์เลี้ยง:** จัดการข้อมูลส่วนตัว บันทึกข้อมูลสัตว์เลี้ยง (My Pets) สะสมแต้มสมาชิก
- **ระบบสั่งซื้อและการชำระเงิน:** รถเข็นสินค้า (Cart), ทำรายการสั่งซื้อ (Checkout), แนบสลิปโอนเงิน (PromptPay QR)
- **ประวัติการสั่งซื้อ:** ติดตามสถานะคำสั่งซื้อ ตรวจสอบเลขพัสดุ ยกเลิกคำสั่งซื้อ และขอคืนเงิน (Refund)

### 💻 2. ฝั่งพนักงานหน้าร้าน (POS - Point of Sale)
- **ระบบคิดเงินหน้าร้าน:** สแกน/เลือกสินค้า ค้นหาสมาชิก คำนวณแต้มสะสม
- **การรับชำระเงิน:** รองรับเงินสดและโอนผ่าน QR Code
- **การออกใบเสร็จ:** พิมพ์ใบเสร็จ/ใบกำกับภาษีอย่างย่อ

### ⚙️ 3. ฝั่งผู้ดูแลระบบและพนักงาน (Admin & Staff Management)
- **Dashboard:** สรุปยอดขาย รายได้ คำสั่งซื้อ และสถิติภาพรวม
- **การจัดการสินค้าและสต็อก:** เพิ่ม/แก้ไขสินค้า จัดการหมวดหมู่ ล็อตสินค้า (Lots/Stock) แจ้งเตือนสินค้าใกล้หมด
- **การจัดการคำสั่งซื้อและจัดส่ง:** ตรวจสอบสลิป อนุมัติคำสั่งซื้อ ออกเลขพัสดุ
- **การจัดการคืนเงิน (Refunds):** ตรวจสอบและอนุมัติการขอคืนเงิน
- **การจัดการบุคลากร (Staff):** จัดตารางงาน (Schedule), บันทึกเวลาเข้า-ออกงาน (Attendance), คำนวณเงินเดือน (Payroll)
- **โปรโมชั่นและส่วนลด:** จัดการคูปองโค้ดและแคมเปญส่งเสริมการขาย

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend:** HTML5, CSS3, Tailwind CSS, JavaScript (ES6+), Vite
- **Backend:** PHP 8.x (RESTful API Architecture, PDO)
- **Database:** MySQL / MariaDB (UTF-8 MB4)
- **Security:** Session Authentication, Role-based Access Control (Admin, Staff, Customer), Prepared Statements (SQL Injection Protection), CSRF Prevention

---

## 🚀 วิธีการติดตั้งและรันระบบ (Local Installation & Setup)

### 1. โคลนคลังโค้ด (Clone Repository)
```bash
git clone https://github.com/juju-eiei/Hello-Pet-Shop2.git
cd Hello-Pet-Shop2
```

### 2. นำเข้าฐานข้อมูล (Database Import)
1. เปิด **phpMyAdmin** หรือ MySQL Client
2. สร้างฐานข้อมูลชื่อ `hello_pet_shop2`
3. นำเข้าไฟล์ `database_setup.sql` เข้าสู่ฐานข้อมูล

### 3. ตั้งค่าสภาพแวดล้อม (Environment Config)
คัดลอกไฟล์ `.env.example` เป็น `.env` และแก้ไขข้อมูลการเชื่อมต่อฐานข้อมูลตามเครื่องของคุณ:
```ini
DB_HOST=localhost
DB_NAME=hello_pet_shop2
DB_USER=root
DB_PASS=
```

### 4. ติดตั้ง Dependencies และรันระบบ
```bash
# ติดตั้ง Frontend dependencies
npm install

# รัน Backend (PHP Server ที่พอร์ต 8000)
npm run backend
# หรือรัน: php -S localhost:8000 index.php

# ในอีก terminal ให้รัน Frontend (Vite)
npm run dev
```

เปิดบราวเซอร์ไปที่: `http://localhost:5173`

---

## 👥 บัญชีผู้ใช้สำหรับทดสอบ (Demo Accounts)

| บทบาท (Role) | บัญชีผู้ใช้ (Username) | รหัสผ่าน (Password) |
|---|---|---|
| **Admin (ผู้ดูแลระบบ)** | `admin` | `password` (หรือรหัสผ่านที่ตั้งใน DB) |
| **Staff (พนักงาน)** | `staff` | `password` |
| **Customer (ลูกค้า)** | `customer` | `password` |

---

## 📂 โครงสร้างโฟลเดอร์หลัก (Project Structure)
```
Hello_Pet_Shop2/
├── config/              # ไฟล์เชื่อมต่อฐานข้อมูลและการตั้งค่าระบบ
├── controllers/         # ตัวประมวลผลคำขอ (Auth, Order, Product, Staff, etc.)
├── models/              # โมเดลข้อมูลและการจัดการ Query
├── middlewares/         # ตัวตรวจสอบสิทธิ์ (AuthMiddleware, Role checks)
├── routes/              # เส้นทาง API Routing
├── src/                 # ไฟล์ Frontend JavaScript & CSS
├── uploads/             # ไฟล์ภาพที่อัปโหลด (สลิป, ภาพสินค้า)
├── database_setup.sql   # สคริปต์โครงสร้างฐานข้อมูลเริ่มต้น
├── index.php            # จุดเข้าใช้งาน Backend API
├── vite.config.js       # การตั้งค่า Vite Dev Server
└── README.md            # คู่มือระบบ
```

---

## 📄 License
ISC License
