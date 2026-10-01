import { updateGlobalCartCount, updateNavProfile } from './main.js';
import { updateActiveMenu } from './components/layout.js';
import { initProductsPage } from './products.js';
import { initCartPage } from './cart.js';
import { initCheckoutPage } from './checkout.js';
import { initOrderHistoryPage } from './order-history.js';
import { initMyPetsPage } from './my-pets.js';
import { initProfilePage } from './profile.js';
import { initContactPage } from './contact.js';

// Cache for HTML templates to make transitions instant (0ms)
const pageCache = new Map();

// Universal Route Catalog
const routes = {
    // ===== Customer Routes =====
    '/': { file: '/products.html', category: 'customer', init: initProductsPage, title: 'รายการสินค้า - Hello Pet Shop' },
    '/home': { file: '/products.html', category: 'customer', init: initProductsPage, title: 'รายการสินค้า - Hello Pet Shop' },
    '/products': { file: '/products.html', category: 'customer', init: initProductsPage, title: 'รายการสินค้า - Hello Pet Shop' },
    '/products.html': { file: '/products.html', category: 'customer', init: initProductsPage, title: 'รายการสินค้า - Hello Pet Shop' },

    '/my-pets': { file: '/my-pets.html', category: 'customer', init: initMyPetsPage, title: 'สัตว์เลี้ยงของฉัน - Hello Pet Shop' },
    '/my-pets.html': { file: '/my-pets.html', category: 'customer', init: initMyPetsPage, title: 'สัตว์เลี้ยงของฉัน - Hello Pet Shop' },

    '/orders': { file: '/order-history.html', category: 'customer', init: initOrderHistoryPage, title: 'ประวัติคำสั่งซื้อ - Hello Pet Shop' },
    '/order-history': { file: '/order-history.html', category: 'customer', init: initOrderHistoryPage, title: 'ประวัติคำสั่งซื้อ - Hello Pet Shop' },
    '/order-history.html': { file: '/order-history.html', category: 'customer', init: initOrderHistoryPage, title: 'ประวัติคำสั่งซื้อ - Hello Pet Shop' },

    '/cart': { file: '/cart.html', category: 'customer', init: initCartPage, title: 'ตะกร้าสินค้า - Hello Pet Shop' },
    '/cart.html': { file: '/cart.html', category: 'customer', init: initCartPage, title: 'ตะกร้าสินค้า - Hello Pet Shop' },

    '/checkout': { file: '/checkout.html', category: 'customer', init: initCheckoutPage, title: 'ชำระเงิน - Hello Pet Shop' },
    '/checkout.html': { file: '/checkout.html', category: 'customer', init: initCheckoutPage, title: 'ชำระเงิน - Hello Pet Shop' },

    '/profile': { file: '/profile.html', category: 'customer', init: initProfilePage, title: 'ข้อมูลส่วนตัว - Hello Pet Shop' },
    '/profile.html': { file: '/profile.html', category: 'customer', init: initProfilePage, title: 'ข้อมูลส่วนตัว - Hello Pet Shop' },

    '/contact': { file: '/contact.html', category: 'customer', init: initContactPage, title: 'ติดต่อเรา - Hello Pet Shop' },
    '/contact.html': { file: '/contact.html', category: 'customer', init: initContactPage, title: 'ติดต่อเรา - Hello Pet Shop' },

    // ===== Admin Routes =====
    '/admin': { file: '/admin_orders.html', category: 'admin', title: 'จัดการคำสั่งซื้อ - Hello Pet Shop' },
    '/admin/dashboard': { file: '/admin_dashboard.html', category: 'admin', title: 'แดชบอร์ด - Hello Pet Shop' },
    '/admin_dashboard.html': { file: '/admin_dashboard.html', category: 'admin', title: 'แดชบอร์ด - Hello Pet Shop' },

    '/admin/products': { file: '/admin_product_management.html', category: 'admin', title: 'จัดการสินค้า - Hello Pet Shop' },
    '/admin_product_management.html': { file: '/admin_product_management.html', category: 'admin', title: 'จัดการสินค้า - Hello Pet Shop' },

    '/admin/products/edit': { file: '/admin_product_edit.html', category: 'admin', title: 'แก้ไขสินค้า - Hello Pet Shop' },
    '/admin_product_edit.html': { file: '/admin_product_edit.html', category: 'admin', title: 'แก้ไขสินค้า - Hello Pet Shop' },

    '/admin/stock': { file: '/admin_stock.html', category: 'admin', title: 'จัดการคลังสินค้า - Hello Pet Shop' },
    '/admin_stock.html': { file: '/admin_stock.html', category: 'admin', title: 'จัดการคลังสินค้า - Hello Pet Shop' },

    '/admin/categories': { file: '/admin_categories.html', category: 'admin', title: 'จัดการหมวดหมู่สินค้า - Hello Pet Shop' },
    '/admin_categories.html': { file: '/admin_categories.html', category: 'admin', title: 'จัดการหมวดหมู่สินค้า - Hello Pet Shop' },

    '/admin/pet-types': { file: '/admin_pet_types.html', category: 'admin', title: 'จัดการประเภทสัตว์เลี้ยง - Hello Pet Shop' },
    '/admin_pet_types.html': { file: '/admin_pet_types.html', category: 'admin', title: 'จัดการประเภทสัตว์เลี้ยง - Hello Pet Shop' },

    '/admin/promotions': { file: '/admin_promotions.html', category: 'admin', title: 'จัดการโปรโมชั่น - Hello Pet Shop' },
    '/admin_promotions.html': { file: '/admin_promotions.html', category: 'admin', title: 'จัดการโปรโมชั่น - Hello Pet Shop' },

    '/admin/orders': { file: '/admin_orders.html', category: 'admin', title: 'จัดการคำสั่งซื้อ - Hello Pet Shop' },
    '/admin_orders.html': { file: '/admin_orders.html', category: 'admin', title: 'จัดการคำสั่งซื้อ - Hello Pet Shop' },

    '/admin/orders/details': { file: '/admin_order_details.html', category: 'admin', title: 'รายละเอียดคำสั่งซื้อ - Hello Pet Shop' },
    '/admin_order_details.html': { file: '/admin_order_details.html', category: 'admin', title: 'รายละเอียดคำสั่งซื้อ - Hello Pet Shop' },

    '/admin/refunds': { file: '/admin_refunds.html', category: 'admin', title: 'จัดการการคืนเงิน - Hello Pet Shop' },
    '/admin_refunds.html': { file: '/admin_refunds.html', category: 'admin', title: 'จัดการการคืนเงิน - Hello Pet Shop' },

    '/admin/customers': { file: '/admin_customers.html', category: 'admin', title: 'จัดการลูกค้า - Hello Pet Shop' },
    '/admin_customers.html': { file: '/admin_customers.html', category: 'admin', title: 'จัดการลูกค้า - Hello Pet Shop' },

    '/admin/customers/details': { file: '/admin_customer_details.html', category: 'admin', title: 'ข้อมูลลูกค้า - Hello Pet Shop' },
    '/admin_customer_details.html': { file: '/admin_customer_details.html', category: 'admin', title: 'ข้อมูลลูกค้า - Hello Pet Shop' },

    '/admin/delivery': { file: '/admin_delivery.html', category: 'admin', title: 'จัดการระบบขนส่ง - Hello Pet Shop' },
    '/admin_delivery.html': { file: '/admin_delivery.html', category: 'admin', title: 'จัดการระบบขนส่ง - Hello Pet Shop' },

    '/admin/rewards': { file: '/admin_reward_management.html', category: 'admin', title: 'จัดการแต้มสะสม - Hello Pet Shop' },
    '/admin_reward_management.html': { file: '/admin_reward_management.html', category: 'admin', title: 'จัดการแต้มสะสม - Hello Pet Shop' },

    '/admin/staff': { file: '/admin_staff.html', category: 'admin', title: 'จัดการพนักงาน - Hello Pet Shop' },
    '/admin_staff.html': { file: '/admin_staff.html', category: 'admin', title: 'จัดการพนักงาน - Hello Pet Shop' },

    '/admin/schedule': { file: '/admin_schedule.html', category: 'admin', title: 'ตารางงานพนักงาน - Hello Pet Shop' },
    '/admin_schedule.html': { file: '/admin_schedule.html', category: 'admin', title: 'ตารางงานพนักงาน - Hello Pet Shop' },

    '/admin/attendance': { file: '/admin_attendance.html', category: 'admin', title: 'ตรวจสอบการเข้าทำงาน - Hello Pet Shop' },
    '/admin_attendance.html': { file: '/admin_attendance.html', category: 'admin', title: 'ตรวจสอบการเข้าทำงาน - Hello Pet Shop' },

    '/admin/payroll': { file: '/admin_payroll.html', category: 'admin', title: 'จัดการจ่ายเงินเดือน - Hello Pet Shop' },
    '/admin_payroll.html': { file: '/admin_payroll.html', category: 'admin', title: 'จัดการจ่ายเงินเดือน - Hello Pet Shop' },

    '/admin/payroll/settings': { file: '/admin_pay_settings.html', category: 'admin', title: 'กำหนดอัตราค่าจ้าง - Hello Pet Shop' },
    '/admin_pay_settings.html': { file: '/admin_pay_settings.html', category: 'admin', title: 'กำหนดอัตราค่าจ้าง - Hello Pet Shop' },

    '/admin/transactions': { file: '/admin_transactions.html', category: 'admin', title: 'จัดการรายรับรายจ่าย - Hello Pet Shop' },
    '/admin_transactions.html': { file: '/admin_transactions.html', category: 'admin', title: 'จัดการรายรับรายจ่าย - Hello Pet Shop' },

    '/admin/payment-settings': { file: '/admin_payment_settings.html', category: 'admin', title: 'ตั้งค่าบัญชีรับเงิน & QR Code - Hello Pet Shop' },
    '/admin_payment_settings.html': { file: '/admin_payment_settings.html', category: 'admin', title: 'ตั้งค่าบัญชีรับเงิน & QR Code - Hello Pet Shop' },

    // ===== Staff Routes =====
    '/staff': { file: '/staff_profile.html', category: 'staff', title: 'โปรไฟล์พนักงาน - Hello Pet Shop' },
    '/staff/profile': { file: '/staff_profile.html', category: 'staff', title: 'โปรไฟล์พนักงาน - Hello Pet Shop' },
    '/staff_profile.html': { file: '/staff_profile.html', category: 'staff', title: 'โปรไฟล์พนักงาน - Hello Pet Shop' },

    '/staff/stock': { file: '/staff_stock.html', category: 'staff', title: 'คลังสินค้า - Hello Pet Shop' },
    '/staff_stock.html': { file: '/staff_stock.html', category: 'staff', title: 'คลังสินค้า - Hello Pet Shop' },

    '/staff/orders': { file: '/staff_orders.html', category: 'staff', title: 'คำสั่งซื้อ - Hello Pet Shop' },
    '/staff_orders.html': { file: '/staff_orders.html', category: 'staff', title: 'คำสั่งซื้อ - Hello Pet Shop' },

    '/staff/orders/details': { file: '/staff_order_details.html', category: 'staff', title: 'รายละเอียดคำสั่งซื้อ - Hello Pet Shop' },
    '/staff_order_details.html': { file: '/staff_order_details.html', category: 'staff', title: 'รายละเอียดคำสั่งซื้อ - Hello Pet Shop' },

    '/staff/refunds': { file: '/staff_refunds.html', category: 'staff', title: 'จัดการการคืนเงิน - Hello Pet Shop' },
    '/staff_refunds.html': { file: '/staff_refunds.html', category: 'staff', title: 'จัดการการคืนเงิน - Hello Pet Shop' },

    '/staff/customers': { file: '/staff_customers.html', category: 'staff', title: 'ข้อมูลลูกค้า - Hello Pet Shop' },
    '/staff_customers.html': { file: '/staff_customers.html', category: 'staff', title: 'ข้อมูลลูกค้า - Hello Pet Shop' },

    '/staff/customers/details': { file: '/staff_customer_details.html', category: 'staff', title: 'ข้อมูลลูกค้า - Hello Pet Shop' },
    '/staff_customer_details.html': { file: '/staff_customer_details.html', category: 'staff', title: 'ข้อมูลลูกค้า - Hello Pet Shop' },

    '/staff/promotions': { file: '/staff_promotions.html', category: 'staff', title: 'โปรโมชั่น - Hello Pet Shop' },
    '/staff_promotions.html': { file: '/staff_promotions.html', category: 'staff', title: 'โปรโมชั่น - Hello Pet Shop' },

    '/staff/schedule': { file: '/staff_schedule.html', category: 'staff', title: 'ตารางงานและวันเข้างาน - Hello Pet Shop' },
    '/staff_schedule.html': { file: '/staff_schedule.html', category: 'staff', title: 'ตารางงานและวันเข้างาน - Hello Pet Shop' }
};

export function getRouteInfo(pathname) {
    if (!pathname) return null;
    let clean = pathname.split('?')[0].split('#')[0].trim();
    if (!clean.startsWith('/') && !clean.startsWith('http')) {
        clean = '/' + clean;
    } else if (clean.startsWith('http')) {
        try {
            clean = new URL(clean).pathname;
        } catch (e) {}
    }
    return routes[clean] || null;
}

export function isCustomerRoute(pathname) {
    const info = getRouteInfo(pathname);
    return info && info.category === 'customer';
}

export function normalizeCustomerPath(path) {
    if (!path) return '';
    let clean = path.split('?')[0].split('#')[0].trim();
    if (!clean.startsWith('/') && !clean.startsWith('http')) {
        clean = '/' + clean;
    } else if (clean.startsWith('http')) {
        try {
            clean = new URL(clean).pathname;
        } catch (e) {}
    }
    
    if (clean === '' || clean === '/' || clean === '/home' || clean === '/products' || clean === '/products.html') {
        return '/products';
    }
    if (clean === '/my-pets' || clean === '/my-pets.html') {
        return '/my-pets';
    }
    if (clean === '/orders' || clean === '/order-history' || clean === '/order-history.html') {
        return '/orders';
    }
    if (clean === '/cart' || clean === '/cart.html') {
        return '/cart';
    }
    if (clean === '/checkout' || clean === '/checkout.html') {
        return '/checkout';
    }
    if (clean === '/profile' || clean === '/profile.html') {
        return '/profile';
    }
    if (clean === '/contact' || clean === '/contact.html') {
        return '/contact';
    }
    return clean.replace(/\.html$/, '');
}

export async function navigateTo(url, pushState = true) {
    if (!url) return;

    const targetUrl = new URL(url, window.location.origin);
    const pathname = targetUrl.pathname;
    const search = targetUrl.search;
    const hash = targetUrl.hash;

    const currentInfo = getRouteInfo(window.location.pathname);
    const targetInfo = getRouteInfo(pathname);

    // If destination is not an SPA-registered route (e.g. login, pos, external), navigate normally
    if (!targetInfo) {
        window.location.href = url;
        return;
    }

    // If crossing layout categories (e.g. from customer to admin, or admin to customer), do a clean full transition
    if (currentInfo && targetInfo.category !== currentInfo.category) {
        window.location.href = url;
        return;
    }

    // If navigating to the exact same URL with no query difference, do nothing
    if (pushState && window.location.pathname === pathname && window.location.search === search) {
        return;
    }

    try {
        let htmlText = pageCache.get(targetInfo.file);
        if (!htmlText) {
            const res = await fetch(targetInfo.file);
            if (!res.ok) {
                window.location.href = url;
                return;
            }
            htmlText = await res.text();
            pageCache.set(targetInfo.file, htmlText);
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // 1. Destroy any existing Chart.js instances to avoid canvas reuse errors
        if (typeof window.Chart !== 'undefined' && typeof window.Chart.instances === 'object') {
            try {
                Object.keys(window.Chart.instances).forEach(key => {
                    const inst = window.Chart.instances[key];
                    if (inst && typeof inst.destroy === 'function') {
                        inst.destroy();
                    }
                });
            } catch (e) {}
        }

        // 2. Synchronize Page-Specific <style> and <link rel="stylesheet"> elements safely (filter out opacity hacks)
        document.querySelectorAll('style[data-spa-style="true"], link[data-spa-style="true"]').forEach(el => el.remove());

        doc.querySelectorAll('style').forEach(styleEl => {
            let css = styleEl.textContent || '';
            // Remove dangerous opacity: 0 and .rendered hacks that cause black/white screen flash
            css = css.replace(/html\s*\{\s*opacity:\s*0[^}]*\}/gi, '');
            css = css.replace(/html\.rendered\s*\{[^}]*\}/gi, '');
            css = css.trim();
            if (css) {
                const newStyle = document.createElement('style');
                newStyle.setAttribute('data-spa-style', 'true');
                newStyle.textContent = css;
                document.head.appendChild(newStyle);
            }
        });

        doc.querySelectorAll('link[rel="stylesheet"]').forEach(linkEl => {
            const href = linkEl.getAttribute('href');
            if (href && !document.querySelector(`link[href="${href}"]`)) {
                const newLink = document.createElement('link');
                newLink.setAttribute('rel', 'stylesheet');
                newLink.setAttribute('href', href);
                newLink.setAttribute('data-spa-style', 'true');
                document.head.appendChild(newLink);
            }
        });

        // Function to perform the actual DOM mutation
        const applyDOMUpdates = () => {
            // 3. Swap Main Content
            const newMain = doc.querySelector('main');
            const currentMain = document.querySelector('main');

            if (newMain && currentMain) {
                currentMain.replaceWith(newMain);
                newMain.classList.add('spa-fade-in');
            }

            // Clean up any stray sections or orphan elements between main and footer/bottomNav
            document.querySelectorAll('body > section').forEach(sec => {
                if (!sec.closest('main')) {
                    sec.remove();
                }
            });

            // 4. Synchronize Floating Modals & Drawers (those outside <main>)
            const floatingOverlaysSelector = '.modal, .modal-overlay, .modal-backdrop, .drawer-overlay, .po-modal-overlay, .print-layout-overlay, #drawerOverlay, #attendanceOverlay, #dateDetailOverlay, #inspectOverlay, #bookingOverlay, #bannerModal, #giftModal, #restockModal, #categoryModal, #paymentQrModal, #successModal, #petFormModal, #petModal, #editCustomerModal, #deleteModal, #confirmModal, #editProfileModal, #orderDetailModal, #payNowModal, #createPoModal, #poHistoryModal, #stockHistoryModal, #receivePoModal';
            
            const incomingModals = Array.from(doc.querySelectorAll(floatingOverlaysSelector)).filter(el => !el.closest('main'));
            const incomingModalIds = new Set(incomingModals.map(m => m.id).filter(Boolean));

            // Clean up modals from previous page that are not in incoming page
            document.querySelectorAll(floatingOverlaysSelector).forEach(el => {
                if (!el.closest('main') && el.id && !incomingModalIds.has(el.id)) {
                    el.remove();
                }
            });

            // Add or update incoming modals
            incomingModals.forEach(el => {
                if (el.id) {
                    const existing = document.getElementById(el.id);
                    if (existing) {
                        existing.replaceWith(el.cloneNode(true));
                        return;
                    }
                }
                document.body.appendChild(el.cloneNode(true));
            });

            // Synchronize Footer smoothly without destroying layout
            const incomingFooter = doc.querySelector('footer');
            const currentFooter = document.querySelector('footer');

            if (incomingFooter) {
                if (currentFooter) {
                    // Update content in-place to avoid layout shift / scroll jerk
                    if (currentFooter.innerHTML !== incomingFooter.innerHTML) {
                        currentFooter.innerHTML = incomingFooter.innerHTML;
                    }
                    currentFooter.className = incomingFooter.className;
                } else {
                    const footerClone = incomingFooter.cloneNode(true);
                    const bottomNav = document.querySelector('.customer-bottom-nav');
                    if (bottomNav) {
                        document.body.insertBefore(footerClone, bottomNav);
                    } else {
                        document.body.appendChild(footerClone);
                    }
                }
            } else if (currentFooter) {
                currentFooter.remove();
            }

            // Sync body classes safely (strip 'preload' to allow smooth transitions)
            if (doc.body && doc.body.className) {
                const cleanBodyClass = doc.body.className.replace(/\bpreload\b/g, '').trim();
                document.body.className = cleanBodyClass;
            }

            // Ensure html always stays visible and smooth
            document.documentElement.style.opacity = '1';
            document.documentElement.classList.add('rendered');

            // 5. Update Document Title & Mobile Header Title
            const pageTitle = targetInfo.title || doc.title || '';
            if (pageTitle) {
                document.title = pageTitle;
                const mobileHeaderTitle = document.querySelector('header.mobile-header h2');
                if (mobileHeaderTitle) {
                    const cleanTitle = pageTitle.split('-')[0].trim();
                    if (cleanTitle) mobileHeaderTitle.textContent = cleanTitle;
                }
            }

            // 6. Update History
            if (pushState) {
                history.pushState({ path: pathname }, '', pathname + search + hash);
            }

            // 7. Scroll to top
            window.scrollTo({ top: 0, behavior: 'instant' });

            // 8. Update Active Navigation States & Run Modular Initializers NOW that new DOM is mounted!
            if (targetInfo.category === 'customer') {
                updateActiveNavLinks(pathname);
                updateGlobalCartCount();
                updateNavProfile();

                // Run Modular Customer Page Initializer
                if (typeof targetInfo.init === 'function') {
                    try {
                        targetInfo.init();
                    } catch (initErr) {
                        console.error('Error in customer page init:', initErr);
                    }
                }
            } else if (targetInfo.category === 'admin' || targetInfo.category === 'staff') {
                updateActiveMenu(pathname);
            }

            // 9. Re-execute Page-specific Scripts for Admin/Staff pages safely
            executePageScripts(doc);
        };

        // If browser supports native View Transitions, use it; otherwise execute directly
        if (typeof document.startViewTransition === 'function') {
            document.startViewTransition(() => {
                applyDOMUpdates();
            });
        } else {
            applyDOMUpdates();
        }

    } catch (error) {
        console.error('SPA Navigation Error:', error);
        window.location.href = url;
    }
}

function executePageScripts(doc) {
    const scripts = doc.querySelectorAll('script:not([type="module"])');
    scripts.forEach(oldScript => {
        // Skip main.js or already loaded bundle dependencies
        if (oldScript.src && (oldScript.src.includes('/src/js/main.js') || oldScript.src.includes('chart.js') || oldScript.src.includes('sweetalert2') || oldScript.src.includes('font-awesome') || oldScript.src.includes('tesseract') || oldScript.src.includes('pdf.js'))) {
            return;
        }

        let scriptContent = oldScript.textContent.trim();
        if (!scriptContent && !oldScript.src) return;

        // Skip pure mobile check or rendered opacity boilerplate
        if (scriptContent.includes('document.documentElement.classList.add(\'mobile-device\')')) return;
        if (scriptContent.includes('classList.add(\'rendered\')')) return;

        try {
            // Find all function declarations to export to window so inline onclick handlers work seamlessly
            const exposedFunctions = new Set();
            const funcMatches = scriptContent.matchAll(/(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/g);
            for (const match of funcMatches) {
                if (match[1]) exposedFunctions.add(match[1]);
            }
            const varFuncMatches = scriptContent.matchAll(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/g);
            for (const match of varFuncMatches) {
                if (match[1]) exposedFunctions.add(match[1]);
            }
            const varRegularFuncMatches = scriptContent.matchAll(/(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?function/g);
            for (const match of varRegularFuncMatches) {
                if (match[1]) exposedFunctions.add(match[1]);
            }
            const exposedExports = Array.from(exposedFunctions).map(fn => `window.${fn} = ${fn};`);

            // Wrap inside IIFE so variables (let/const/var) run in an isolated scope and never collide with existing window globals
            const wrappedScript = `
(function() {
    try {
        ${scriptContent}
        ${exposedExports.join('\n')}
    } catch(err) {
        console.error("SPA Page Script Runtime Error:", err);
    }
})();
`;

            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            newScript.textContent = wrappedScript;
            document.body.appendChild(newScript);
            newScript.remove(); // Clean up tag after inline execution
        } catch (e) {
            console.warn("Script execution error on SPA navigation:", e);
        }
    });

    // Also trigger DOMContentLoaded for any listeners attached inside scripts
    document.dispatchEvent(new Event('DOMContentLoaded'));
}

export function updateActiveNavLinks(pathname) {
    const cleanPath = normalizeCustomerPath(pathname || window.location.pathname);
    const mainNavLinks = ['/products', '/my-pets', '/orders'];

    // Desktop Header Navigation Links
    document.querySelectorAll('header nav a, header.nav-green a').forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        
        // Skip logo, cart, or profile dropdown links
        if (a.querySelector('i.fa-paw') || a.querySelector('i.fa-shopping-basket') || a.closest('#navProfileDropdown')) {
            return;
        }

        const norm = normalizeCustomerPath(href);
        if (mainNavLinks.includes(norm)) {
            if (norm === cleanPath) {
                a.classList.add('font-bold', 'text-white', 'pb-1', 'border-b-2', 'border-white');
                a.classList.remove('text-gray-200', 'font-medium', 'border-transparent');
            } else {
                a.classList.remove('font-bold', 'pb-1', 'border-b-2', 'border-white');
                a.classList.add('text-gray-200', 'font-medium');
            }
        }
    });

    // Mobile Bottom Navigation
    document.querySelectorAll('.customer-bottom-nav a, .customer-nav-item, nav.bottom-nav a').forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        const norm = normalizeCustomerPath(href);
        if (norm === cleanPath) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });
}

export function initSpaRouter() {
    const currentPath = window.location.pathname;
    const currentInfo = getRouteInfo(currentPath);

    // Global Link Interceptor for SPA
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Skip non-HTTP links, external links, blank targets, download links, or logout links
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        if (link.target === '_blank' || link.hasAttribute('download') || link.id === 'logoutBtn' || link.classList.contains('logout-item')) return;

        try {
            const url = new URL(link.href, window.location.origin);
            if (url.origin !== window.location.origin) return;

            const targetInfo = getRouteInfo(url.pathname);
            if (targetInfo) {
                e.preventDefault();
                navigateTo(url.pathname + url.search + url.hash, true);
            }
        } catch (err) {
            // Ignore invalid URLs
        }
    });

    // Handle Browser Back / Forward buttons
    window.addEventListener('popstate', () => {
        navigateTo(window.location.pathname + window.location.search + window.location.hash, false);
    });

    // Highlight current active nav on first load
    if (currentInfo && currentInfo.category === 'customer') {
        updateActiveNavLinks(currentPath);
    } else if (currentInfo && (currentInfo.category === 'admin' || currentInfo.category === 'staff')) {
        updateActiveMenu(currentPath);
    }

    // Expose navigateTo globally
    window.navigateTo = navigateTo;
}
