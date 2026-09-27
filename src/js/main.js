import '../css/style.css';
import Swal from 'sweetalert2';
import { initLayout } from './components/layout.js';
import { initRouter } from './router.js';
import { initSpaRouter } from './spa.js';
import { getUserProfileData, getCartData, performLogout } from './utils.js';

// Expose Swal globally
window.Swal = Swal;

// Expose Swal globally
window.Swal = Swal;

// Intercept and override native browser alert with beautiful SweetAlert2
window.alert = function (message) {
    let icon = 'info';
    let title = 'แจ้งเตือน';
    
    if (message) {
        const msgStr = String(message);
        const messageLower = msgStr.toLowerCase();
        if (messageLower.includes('สำเร็จ') || messageLower.includes('บันทึกแล้ว') || messageLower.includes('success')) {
            icon = 'success';
            title = 'สำเร็จ';
        } else if (
            messageLower.includes('ผิดพลาด') || 
            messageLower.includes('ไม่สำเร็จ') || 
            messageLower.includes('ล้มเหลว') || 
            messageLower.includes('error') || 
            messageLower.includes('failed') || 
            messageLower.includes('invalid')
        ) {
            icon = 'error';
            title = 'เกิดข้อผิดพลาด';
        } else if (
            messageLower.includes('ไม่มีสิทธิ์') || 
            messageLower.includes('denied') || 
            messageLower.includes('ระวัง') || 
            messageLower.includes('warning')
        ) {
            icon = 'warning';
            title = 'แจ้งเตือนระบบ';
        }
    }

    Swal.fire({
        title: title,
        text: message,
        icon: icon,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#4D7C68' // Matches --secondary-berry brand color
    });
};


// Global Security & CSRF Interceptor
if (!window.__csrfInterceptorInstalled) {
    window.__csrfInterceptorInstalled = true;
    const originalFetch = window.fetch;
    window.fetch = async function(url, options) {
        options = options || {};
        const method = (options.method || "GET").toUpperCase();
        
        options.headers = options.headers || {};

        // Attach X-User-Id and X-User-Role for resilient auth
        try {
            const curUser = JSON.parse(localStorage.getItem("user") || "{}");
            if (curUser && curUser.user_id) {
                if (options.headers instanceof Headers) {
                    if (!options.headers.has("X-User-Id")) options.headers.set("X-User-Id", curUser.user_id);
                    if (curUser.role_name && !options.headers.has("X-User-Role")) options.headers.set("X-User-Role", curUser.role_name);
                } else if (Array.isArray(options.headers)) {
                    if (!options.headers.some(h => h[0].toLowerCase() === "x-user-id")) options.headers.push(["X-User-Id", curUser.user_id]);
                    if (curUser.role_name && !options.headers.some(h => h[0].toLowerCase() === "x-user-role")) options.headers.push(["X-User-Role", curUser.role_name]);
                } else {
                    if (!options.headers["X-User-Id"]) options.headers["X-User-Id"] = curUser.user_id;
                    if (curUser.role_name && !options.headers["X-User-Role"]) options.headers["X-User-Role"] = curUser.role_name;
                }
            }
        } catch(e) {}

        if (["POST", "PUT", "DELETE"].includes(method)) {
            const token = localStorage.getItem("csrf_token");
            if (token) {
                if (options.headers instanceof Headers) {
                    options.headers.set("X-CSRF-Token", token);
                } else if (Array.isArray(options.headers)) {
                    const exists = options.headers.some(h => h[0].toLowerCase() === "x-csrf-token");
                    if (!exists) options.headers.push(["X-CSRF-Token", token]);
                } else {
                    options.headers["X-CSRF-Token"] = token;
                }
            }
        }
        
        try {
            const response = await originalFetch(url, options);
            
            if (response.ok && (url.includes("/api/login") || url.includes("/api/auth/me"))) {
                const clone = response.clone();
                clone.json().then(result => {
                    if (result && result.data && result.data.csrf_token) {
                        localStorage.setItem("csrf_token", result.data.csrf_token);
                    }
                }).catch(err => console.error("Error parsing auth token:", err));
            }
            
            if (response.status === 401 && !url.includes("/api/login")) {
                localStorage.removeItem("user");
                localStorage.removeItem("csrf_token");
                window.location.href = "/login";
            }
            return response;
        } catch (err) {
            throw err;
        }
    };
}


export function updateNavProfile() {
    const navProfileImage = document.getElementById('navProfileImage');
    const navDefaultAvatar = document.getElementById('navDefaultAvatar');
    
    if (!navProfileImage || !navDefaultAvatar) return;
    
    try {
        const profile = getUserProfileData();
        if (profile && profile.profileImage) {
            navProfileImage.src = profile.profileImage;
            navProfileImage.classList.remove('hidden');
            navDefaultAvatar.classList.add('hidden');
        } else {
            navProfileImage.classList.add('hidden');
            navDefaultAvatar.classList.remove('hidden');
        }
    } catch (e) {
        console.error('Error updating navbar profile avatar:', e);
    }
}

export function updateGlobalCartCount() {
    const cart = getCartData();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cartCount');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Common Initialization
let appInitialized = false;
function initApp() {
    if (appInitialized) return;
    appInitialized = true;
    console.log('Hello Pet Shop - Centralized Layout & SPA Router Initialized');
    
    // Initialize Centralized Layout & Router
    initLayout();
    initRouter();
    initSpaRouter();

    // Global User state check
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        console.log(`Logged in as: ${user.username} (${user.role_name})`);
    }

    // Refresh navbar avatar & cart
    updateNavProfile();
    updateGlobalCartCount();

    // Dynamic Profile Dropdown Toggle
    const profileBtn = document.getElementById('navProfileMenuBtn');
    const profileDropdown = document.getElementById('navProfileDropdown');
    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                profileDropdown.classList.add('hidden');
            }
        });
    }

    // Global Logout Handler for Customer pages
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await performLogout();
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
