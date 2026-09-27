/**
 * Show a professional toast notification
 * @param {string} message - The message to display
 * @param {'success' | 'error' | 'info'} type - The type of toast
 */
export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // Reset classes
    toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl transition-all duration-500 z-50 font-semibold';
    
    // Set type styles
    if (type === 'success') {
        toast.classList.add('bg-green-600', 'text-white');
    } else if (type === 'error') {
        toast.classList.add('bg-red-600', 'text-white');
    } else {
        toast.classList.add('bg-white', 'text-gray-800', 'border', 'border-gray-200');
    }

    toast.textContent = message;
    
    // Animation: Fade In/Up
    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
}

/**
 * Get current user profile data with strict per-user isolation
 */
export function getUserProfileData() {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    if (!userObj.user_id && !userObj.username) {
        return {
            name: 'ผู้ใช้ทั่วไป',
            phone: '',
            address: '',
            province: '',
            zipcode: '',
            email: '',
            profileImage: ''
        };
    }

    const userId = userObj.user_id ? String(userObj.user_id) : String(userObj.username);
    const userKey = `userProfileData_${userId}`;

    const accountProfiles = JSON.parse(localStorage.getItem('savedAccountProfiles') || '{}');
    const accountSaved = accountProfiles[userId] || (userObj.username ? accountProfiles[userObj.username] : {}) || {};
    
    let userStr = localStorage.getItem(userKey);
    let saved = {};
    if (userStr) {
        try { saved = JSON.parse(userStr); } catch(e) {}
    }

    const merged = { ...accountSaved, ...saved };

    let profile = {
        name: merged.name || userObj.first_name || userObj.username || 'ผู้ใช้ทั่วไป',
        phone: merged.phone || userObj.phone || '',
        address: merged.address || userObj.address || '',
        province: merged.province || userObj.province || '',
        zipcode: merged.zipcode || userObj.zipcode || '',
        email: merged.email || userObj.email || '',
        profileImage: merged.profileImage || userObj.profile_image || userObj.profileImage || ''
    };

    return profile;
}

/**
 * Save user profile data with strict per-user isolation
 */
export function saveUserProfileData(data) {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    if (!userObj.user_id && !userObj.username) return;

    const userId = userObj.user_id ? String(userObj.user_id) : String(userObj.username);
    const userKey = `userProfileData_${userId}`;

    // Save strictly to user-specific key
    localStorage.setItem(userKey, JSON.stringify(data));

    // Save to persistent account profile store strictly for this account
    const accountProfiles = JSON.parse(localStorage.getItem('savedAccountProfiles') || '{}');
    accountProfiles[userId] = { ...(accountProfiles[userId] || {}), ...data };
    if (userObj.username) {
        accountProfiles[userObj.username] = { ...(accountProfiles[userObj.username] || {}), ...data };
    }
    localStorage.setItem('savedAccountProfiles', JSON.stringify(accountProfiles));

    // Update active user object in localStorage
    if (userObj) {
        if (data.name) {
            userObj.username = data.name;
            userObj.first_name = data.name;
        }
        if (data.phone) userObj.phone = data.phone;
        if (data.email) userObj.email = data.email;
        if (data.profileImage) {
            userObj.profile_image = data.profileImage;
            userObj.profileImage = data.profileImage;
        }
        if (data.address) userObj.address = data.address;
        localStorage.setItem('user', JSON.stringify(userObj));
    }
}

/**
 * Get current user cart data with strict per-user account persistence
 */
export function getCartData() {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const allKeys = [
        userObj.user_id,
        userObj.customer_id,
        userObj.id,
        userObj.username
    ].filter(Boolean).map(String);

    if (allKeys.length > 0) {
        let savedCarts = {};
        try { savedCarts = JSON.parse(localStorage.getItem('savedUserCarts') || '{}'); } catch(e) {}
        for (const k of allKeys) {
            if (savedCarts[k] && Array.isArray(savedCarts[k])) {
                return savedCarts[k];
            }
        }
        for (const k of allKeys) {
            const localCartStr = localStorage.getItem(`cart_${k}`);
            if (localCartStr) {
                try { return JSON.parse(localCartStr); } catch(e) {}
            }
        }
    }

    let rawCart = localStorage.getItem('cart');
    if (rawCart) {
        try { return JSON.parse(rawCart); } catch(e) {}
    }

    return [];
}

/**
 * Save user cart data with strict per-user account persistence
 */
export function saveCartData(cart) {
    const cartArray = Array.isArray(cart) ? cart : [];
    localStorage.setItem('cart', JSON.stringify(cartArray));

    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const allKeys = [
        userObj.user_id,
        userObj.customer_id,
        userObj.id,
        userObj.username
    ].filter(Boolean).map(String);

    if (allKeys.length > 0) {
        let savedCarts = {};
        try { savedCarts = JSON.parse(localStorage.getItem('savedUserCarts') || '{}'); } catch(e) {}
        allKeys.forEach(k => {
            localStorage.setItem(`cart_${k}`, JSON.stringify(cartArray));
            savedCarts[k] = cartArray;
        });
        localStorage.setItem('savedUserCarts', JSON.stringify(savedCarts));
    }
}

/**
 * Sanitize an order object for safe, lightweight localStorage caching
 * Removes Base64 blobs, strips slipImage, caps item list
 */
export function sanitizeOrderForCache(order) {
    if (!order || typeof order !== 'object') return order;
    const hasSlip = Boolean(order.has_slip || order.hasSlip || (order.slip_image && !String(order.slip_image).startsWith('data:')) || (order.slipImage && !String(order.slipImage).startsWith('data:')));
    
    // Preserve only safe image path if it's a URL/path, never base64
    let safeSlipImage = null;
    const rawSlip = order.slip_image || order.slipImage;
    if (rawSlip && typeof rawSlip === 'string' && !rawSlip.startsWith('data:image/')) {
        safeSlipImage = rawSlip;
    }

    return {
        id: order.id || order.order_id,
        date: order.date || order.order_date || new Date().toISOString(),
        status: order.status,
        total: parseFloat(order.total ?? order.total_amount ?? order.amount ?? 0),
        subtotal: parseFloat(order.subtotal ?? 0),
        shipping: parseFloat(order.shipping ?? order.shipping_fee ?? 0),
        deliveryMethod: order.deliveryMethod || order.company_name || 'Standard Express',
        paymentMethod: order.paymentMethod || order.payment_method || 'transfer',
        payment_status: order.payment_status !== undefined ? order.payment_status : null,
        has_slip: hasSlip,
        hasSlip: hasSlip,
        slipImage: null, // Always null in cache to prevent localStorage quota exhaustion
        slip_image: safeSlipImage,
        items: (order.items || []).slice(0, 10).map(i => ({
            name: i.name || i.product_name || 'สินค้าในรายการ',
            price: parseFloat(i.price || i.unit_price || 0),
            quantity: parseInt(i.quantity || i.qty || 1),
            image: (i.image || i.image_url || '').startsWith('data:') ? '/image/713815-00-allonline-hg.jpg' : (i.image || i.image_url || '/image/713815-00-allonline-hg.jpg')
        })),
        shippingAddress: order.shippingAddress || null,
        customer: order.customer ? { name: order.customer.name, phone: order.customer.phone } : null
    };
}

/**
 * Safely clean up bloated legacy order cache containing Base64 slips or duplicate keys
 * Does NOT delete any data from Database.
 */
export function cleanLegacyOrderStorage() {
    try {
        // 1. Remove the bloated savedUserOrders aggregator key
        if (localStorage.getItem('savedUserOrders')) {
            localStorage.removeItem('savedUserOrders');
        }

        // 2. Clean all order keys in localStorage
        const keysToInspect = ['myOrders'];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('myOrders_')) {
                keysToInspect.push(key);
            }
        }

        keysToInspect.forEach(key => {
            const raw = localStorage.getItem(key);
            if (!raw) return;

            // If it contains Base64 or is unusually large (> 80KB)
            if (raw.includes('data:image/') || raw.length > 80000) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        const cleaned = parsed.slice(0, 20).map(o => sanitizeOrderForCache(o));
                        localStorage.setItem(key, JSON.stringify(cleaned));
                    } else {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    localStorage.removeItem(key);
                }
            }
        });
    } catch (err) {
        console.warn("cleanLegacyOrderStorage warning:", err);
    }
}

// Automatically sanitize and cleanup legacy storage on script load
if (typeof window !== 'undefined' && window.localStorage) {
    cleanLegacyOrderStorage();
}

/**
 * Get current user orders with strict per-user account persistence
 */
export function getUserOrdersData() {
    const userObj = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = userObj.user_id ? String(userObj.user_id) : (userObj.customer_id ? String(userObj.customer_id) : (userObj.id ? String(userObj.id) : (userObj.username ? String(userObj.username) : '')));

    if (userId) {
        const userOrdersKey = `myOrders_${userId}`;
        let localStr = localStorage.getItem(userOrdersKey);
        if (localStr) {
            try { 
                const parsed = JSON.parse(localStr); 
                if (Array.isArray(parsed)) return parsed;
            } catch(e) {}
        }
    }

    let rawOrders = localStorage.getItem('myOrders');
    if (rawOrders) {
        try { 
            const parsed = JSON.parse(rawOrders); 
            if (Array.isArray(parsed)) return parsed;
        } catch(e) {}
    }

    return [];
}

/**
 * Save user orders with strict per-user account persistence (lightweight cache only)
 */
export function saveUserOrdersData(orders) {
    try {
        const ordersArray = Array.isArray(orders) ? orders : [];
        // Keep max 20 latest sanitized orders for lightweight cache
        const sanitized = ordersArray.slice(0, 20).map(o => sanitizeOrderForCache(o));
        const jsonStr = JSON.stringify(sanitized);

        const userObj = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = userObj.user_id ? String(userObj.user_id) : (userObj.customer_id ? String(userObj.customer_id) : (userObj.id ? String(userObj.id) : (userObj.username ? String(userObj.username) : '')));

        try {
            localStorage.setItem('myOrders', jsonStr);
            if (userId) {
                localStorage.setItem(`myOrders_${userId}`, jsonStr);
            }
        } catch (storageErr) {
            console.warn("Storage quota hit, performing cleanup:", storageErr);
            cleanLegacyOrderStorage();
            try {
                // Try saving only the top 5 sanitized orders
                const minimal = sanitized.slice(0, 5);
                localStorage.setItem('myOrders', JSON.stringify(minimal));
                if (userId) {
                    localStorage.setItem(`myOrders_${userId}`, JSON.stringify(minimal));
                }
            } catch (finalErr) {
                console.warn("Could not write order cache; continuing without local cache (Database is source of truth)", finalErr);
            }
        }
    } catch (e) {
        console.warn("saveUserOrdersData error:", e);
    }
}

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Prompts a guest user to register or login when attempting member-restricted actions
 * @param {string} customMessage - Message to display
 */
export function showRegisterPrompt(customMessage = 'กรุณาสมัครสมาชิกเพื่อสั่งซื้อสินค้า') {
    if (window.Swal) {
        window.Swal.fire({
            title: 'กรุณาสมัครสมาชิก',
            text: customMessage,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-user-plus mr-1.5"></i> สมัครสมาชิก',
            cancelButtonText: 'ยกเลิก',
            showDenyButton: true,
            denyButtonText: '<i class="fas fa-sign-in-alt mr-1.5"></i> เข้าสู่ระบบ',
            confirmButtonColor: '#16a34a',
            denyButtonColor: '#1b4332',
            cancelButtonColor: '#9ca3af',
            customClass: {
                popup: 'rounded-2xl shadow-2xl font-sans',
                confirmButton: 'rounded-xl font-bold px-4 py-2.5',
                denyButton: 'rounded-xl font-bold px-4 py-2.5',
                cancelButton: 'rounded-xl font-medium px-4 py-2.5'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'register.html';
            } else if (result.isDenied) {
                window.location.href = 'login.html';
            }
        });
    } else {
        alert(customMessage);
    }
}

/**
 * Universal safe logout helper:
 * Clears server session, cookies, and all user-specific / global caches
 */
export async function performLogout() {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
        console.warn("Server logout request failed:", e);
    }

    try {
        const curUser = JSON.parse(localStorage.getItem('user') || '{}');
        const uid = curUser.user_id ? String(curUser.user_id) : null;
        if (uid) {
            localStorage.removeItem(`userProfileData_${uid}`);
            localStorage.removeItem(`myOrders_${uid}`);
            localStorage.removeItem(`cart_${uid}`);
            localStorage.removeItem(`myPetsData_${uid}`);
        }
        if (curUser.username) {
            localStorage.removeItem(`userProfileData_${curUser.username}`);
            localStorage.removeItem(`myOrders_${curUser.username}`);
            localStorage.removeItem(`cart_${curUser.username}`);
        }
    } catch (e) {}

    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    localStorage.removeItem('myOrders');
    localStorage.removeItem('myPetsData');
    localStorage.removeItem('userProfileData');
    localStorage.removeItem('savedAccountProfiles');
    localStorage.removeItem('savedUserCarts');
    localStorage.removeItem('productsMenuOpen');
    localStorage.removeItem('staffProductsMenuOpen');

    // Expire PHPSESSID cookie on client-side
    document.cookie = "PHPSESSID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    window.location.href = '/login';
}

