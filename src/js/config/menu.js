// Centralized Menu Configuration for Admin & Staff Dashboard with Permission constraints
export const menuConfig = {
    admin: [
        {
            type: 'group',
            id: 'overviewGroup',
            icon: 'fas fa-home',
            title: 'ภาพรวม',
            items: [
                { url: '/admin/dashboard', icon: 'fas fa-tachometer-alt', title: 'แดชบอร์ด', permission: 'dashboard_view' }
            ]
        },
        {
            type: 'group',
            id: 'productsPromotionsGroup',
            icon: 'fas fa-box-open',
            title: 'สินค้าและโปรโมชั่น',
            items: [
                { url: '/admin/products', icon: 'fas fa-boxes', title: 'จัดการสินค้า', permission: 'products_manage' },
                { url: '/admin/stock', icon: 'fas fa-warehouse', title: 'จัดการคลังสินค้า', permission: 'stock_view' },
                { url: '/admin/categories', icon: 'fas fa-tags', title: 'จัดการหมวดหมู่', permission: 'products_manage' },
                { url: '/admin/pet-types', icon: 'fas fa-paw', title: 'ประเภทสัตว์เลี้ยง', permission: 'products_manage' },
                { url: '/admin/promotions', icon: 'fas fa-gift', title: 'โปรโมชั่น', permission: 'promotions_manage' }
            ]
        },
        {
            type: 'group',
            id: 'salesOrdersGroup',
            icon: 'fas fa-shopping-cart',
            title: 'การขายและคำสั่งซื้อ',
            items: [
                { url: '/pos', icon: 'fas fa-cash-register', title: 'ขายหน้าร้าน', permission: 'pos_access' },
                { url: '/admin/orders', icon: 'fas fa-file-invoice', title: 'คำสั่งซื้อ', permission: 'orders_manage' },
                { url: '/admin/refunds', icon: 'fas fa-undo-alt', title: 'จัดการการคืนเงิน', permission: 'orders_manage' },
                { url: '/admin/customers', icon: 'fas fa-users', title: 'ลูกค้า', permission: 'customers_view' },
                { url: '/admin/delivery', icon: 'fas fa-truck', title: 'จัดการขนส่ง', permission: 'delivery_manage' },
                { url: '/admin/rewards', icon: 'fas fa-star', title: 'จัดการแต้มสะสม', permission: 'rewards_manage' }
            ]
        },
        {
            type: 'group',
            id: 'employeesGroup',
            icon: 'fas fa-users-cog',
            title: 'พนักงาน',
            items: [
                { url: '/admin/staff', icon: 'fas fa-user-cog', title: 'จัดการพนักงาน', permission: 'staff_manage' },
                { url: '/admin/schedule', icon: 'fas fa-calendar-alt', title: 'ตารางงานพนักงาน', permission: 'staff_manage' },
                { url: '/admin/attendance', icon: 'fas fa-user-check', title: 'ตรวจสอบการเข้าทำงาน', permission: 'staff_manage' },
                { url: '/admin/payroll/settings', icon: 'fas fa-sliders-h', title: 'กำหนดอัตราค่าจ้าง', permission: 'staff_manage' }
            ]
        },
        {
            type: 'group',
            id: 'financeGroup',
            icon: 'fas fa-wallet',
            title: 'การเงิน',
            items: [
                { url: '/admin/payroll', icon: 'fas fa-money-check-alt', title: 'จัดการจ่ายเงินเดือน', permission: 'staff_manage' },
                { url: '/admin/transactions', icon: 'fas fa-receipt', title: 'จัดการรายรับรายจ่าย', permission: 'dashboard_view' },
                { url: '/admin/payment-settings', icon: 'fas fa-qrcode', title: 'บัญชีรับเงิน & QR Code', permission: 'dashboard_view' }
            ]
        }
    ],
    staff: [
        {
            type: 'group',
            id: 'staffSalesOrdersGroup',
            icon: 'fas fa-shopping-cart',
            title: 'การขายและคำสั่งซื้อ',
            items: [
                { url: '/pos', icon: 'fas fa-cash-register', title: 'ขายหน้าร้าน', permission: 'pos_access' },
                { url: '/staff/orders', icon: 'fas fa-file-invoice', title: 'คำสั่งซื้อ', permission: 'orders_manage' },
                { url: '/staff/refunds', icon: 'fas fa-undo-alt', title: 'จัดการการคืนเงิน', permission: 'orders_manage' },
                { url: '/staff/customers', icon: 'fas fa-users', title: 'ลูกค้า', permission: 'customers_view' }
            ]
        },
        {
            type: 'group',
            id: 'staffProductsPromotionsGroup',
            icon: 'fas fa-box-open',
            title: 'สินค้าและโปรโมชั่น',
            items: [
                { url: '/staff/stock', icon: 'fas fa-warehouse', title: 'คลังสินค้า', permission: 'stock_view' },
                { url: '/staff/promotions', icon: 'fas fa-gift', title: 'โปรโมชั่น', permission: 'promotions_view' }
            ]
        },
        {
            type: 'group',
            id: 'staffPersonalGroup',
            icon: 'fas fa-user-circle',
            title: 'ส่วนตัวและตารางงาน',
            items: [
                { url: '/staff/schedule', icon: 'fas fa-calendar-alt', title: 'ตารางงาน', permission: 'staff_profile_manage' },
                { url: '/staff/profile', icon: 'fas fa-user-cog', title: 'โปรไฟล์ของฉัน', permission: 'staff_profile_manage' }
            ]
        }
    ]
};
