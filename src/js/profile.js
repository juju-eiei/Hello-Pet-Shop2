import { showToast, getUserProfileData, saveUserProfileData, performLogout, getUserOrdersData, saveUserOrdersData } from './utils.js';
import { updateNavProfile } from './main.js';

export function initProfilePage() {
    const cleanPath = (window.location.pathname || '').toLowerCase();
    if (cleanPath.includes('/staff') || cleanPath.includes('/admin') || cleanPath.includes('staff_') || cleanPath.includes('admin_')) return;
    // Elements
    const displayName = document.getElementById('displayName');
    if (!displayName && !document.getElementById('inputName')) return;
    const profileImage = document.getElementById('profileImage');
    const defaultAvatar = document.getElementById('defaultAvatar');
    const modalProfileImage = document.getElementById('modalProfileImage');
    const modalDefaultAvatar = document.getElementById('modalDefaultAvatar');
    const profileImageInput = document.getElementById('profileImageInput');

    // Inputs
    const inputName = document.getElementById('inputName');
    const inputAddress = document.getElementById('inputAddress');
    const inputProvince = document.getElementById('inputProvince');
    const inputZipcode = document.getElementById('inputZipcode');
    const inputPhone = document.getElementById('inputPhone');
    const inputEmail = document.getElementById('inputEmail');

    // Badges
    const badgePendingPayment = document.getElementById('badgePendingPayment');
    const badgePreparing = document.getElementById('badgePreparing');
    const badgeShipping = document.getElementById('badgeShipping');

    // Modal Controls
    const editProfileModal = document.getElementById('editProfileModal');
    const openEditModalBtn = document.getElementById('openEditModalBtn');
    const openEditModalMenuBtn = document.getElementById('openEditModalMenuBtn');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveProfileModalBtn = document.getElementById('saveProfileModalBtn');
    const mainLogoutBtn = document.getElementById('mainLogoutBtn');

    let tempImageSrc = "";

    // Seed Demo Orders if none exist in localStorage
    function seedDemoOrdersIfEmpty() {
        const userObj = JSON.parse(localStorage.getItem('user') || '{}');
        if (userObj.user_id || userObj.username) return; // Real registered user: do NOT seed demo orders!
        const stored = localStorage.getItem('myOrders');
        if (!stored || stored === '[]') {
            const demoOrders = [
                {
                    id: 849201,
                    date: new Date(Date.now() - 3600000 * 2).toISOString(),
                    items: [{ name: "แปรงหวีขนสัตว์เลี้ยง สแตนเลส", price: 320, quantity: 1, image: "/image/713815-00-allonline-hg.jpg" }],
                    subtotal: 320,
                    shipping: 2,
                    total: 322,
                    deliveryMethod: "standard",
                    paymentMethod: "transfer",
                    status: "Pending Payment"
                },
                {
                    id: 739102,
                    date: new Date(Date.now() - 3600000 * 24).toISOString(),
                    items: [{ name: "อาหารแมววิสการ์ส 1.2kg", price: 185, quantity: 2, image: "/image/713815-00-allonline-hg.jpg" }],
                    subtotal: 370,
                    shipping: 2,
                    total: 372,
                    deliveryMethod: "standard",
                    paymentMethod: "transfer",
                    status: "Preparing"
                },
                {
                    id: 619283,
                    date: new Date(Date.now() - 3600000 * 48).toISOString(),
                    items: [{ name: "แชมพูสูตรกำจัดเห็บเหา 500ml", price: 250, quantity: 1, image: "/image/713815-00-allonline-hg.jpg" }],
                    subtotal: 250,
                    shipping: 5,
                    total: 255,
                    deliveryMethod: "express",
                    paymentMethod: "transfer",
                    status: "Shipping",
                    trackingNumber: "TH982341092"
                },
                {
                    id: 510928,
                    date: new Date(Date.now() - 3600000 * 96).toISOString(),
                    items: [{ name: "ของเล่นคอนโดแมว 3 ชั้น", price: 890, quantity: 1, image: "/image/713815-00-allonline-hg.jpg" }],
                    subtotal: 890,
                    shipping: 5,
                    total: 895,
                    deliveryMethod: "express",
                    paymentMethod: "transfer",
                    status: "Completed"
                }
            ];
            localStorage.setItem('myOrders', JSON.stringify(demoOrders));
        }
    }

    // 1. Initial Load & Pre-fill
    async function loadProfile() {
        seedDemoOrdersIfEmpty();

        // 1. Pre-fill immediately from local cache
        let profile = getUserProfileData();
        
        if (profile.name) {
            inputName.value = profile.name;
            if (displayName) displayName.textContent = profile.name;
        }
        if (profile.address) inputAddress.value = profile.address;
        if (profile.province) inputProvince.value = profile.province;
        if (profile.zipcode) inputZipcode.value = profile.zipcode;
        if (profile.phone) inputPhone.value = profile.phone;
        if (profile.email) inputEmail.value = profile.email;

        if (profile.profileImage) {
            tempImageSrc = profile.profileImage;
            updateAvatarDisplays(tempImageSrc);
        }

        // 2. Fetch authoritative profile data from backend MySQL database
        try {
            const userRes = await fetch('/api/customers/details');
            if (userRes.ok) {
                const jsonRes = await userRes.json();
                const cust = jsonRes.data || jsonRes;
                if (cust) {
                    const custName = cust.name || (cust.first_name ? (cust.first_name + (cust.last_name ? ' ' + cust.last_name : '')) : '');
                    if (custName) {
                        inputName.value = custName;
                        if (displayName) displayName.textContent = custName;
                        profile.name = custName;
                    }
                    if (cust.phone !== undefined) {
                        inputPhone.value = cust.phone || '';
                        profile.phone = cust.phone || '';
                    }
                    if (cust.email !== undefined) {
                        inputEmail.value = cust.email || '';
                        profile.email = cust.email || '';
                    }
                    if (cust.address !== undefined) {
                        inputAddress.value = cust.address || '';
                        profile.address = cust.address || '';
                    }
                    if (cust.province !== undefined) {
                        inputProvince.value = cust.province || '';
                        profile.province = cust.province || '';
                    }
                    if (cust.zipcode !== undefined) {
                        inputZipcode.value = cust.zipcode || '';
                        profile.zipcode = cust.zipcode || '';
                    }

                    // Save synced profile to local isolated store
                    saveUserProfileData(profile);

                    // Also sync to main user object in localStorage
                    try {
                        const curUser = JSON.parse(localStorage.getItem('user') || '{}');
                        curUser.phone = cust.phone !== undefined ? cust.phone : (curUser.phone || '');
                        curUser.first_name = cust.first_name || cust.name || curUser.first_name || '';
                        if (cust.last_name !== undefined) curUser.last_name = cust.last_name;
                        if (cust.email) curUser.email = cust.email;
                        curUser.customer_id = cust.id || cust.customer_id || curUser.customer_id;
                        localStorage.setItem('user', JSON.stringify(curUser));
                    } catch(e) {}
                }
            }
        } catch (err) {
            console.warn("Could not fetch customer details from server:", err);
        }

        updateOrderBadges();
        loadUserPoints();
    }

    async function loadUserPoints() {
        const pointsDisplay = document.getElementById('userPointsValue');
        if (!pointsDisplay) return;

        let totalPoints = 0;
        let peBaht = 100;
        let peQty = 1;

        // 1. Fetch admin reward settings (point_earning_baht, point_earning_qty)
        try {
            const settingsRes = await fetch('/api/rewards/settings');
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                const dataObj = settingsData.data || settingsData;
                if (dataObj && dataObj.point_earning_baht) {
                    peBaht = parseFloat(dataObj.point_earning_baht) || 100;
                    peQty = parseInt(dataObj.point_earning_qty) || 1;
                }
            }
        } catch (e) {
            console.warn("Backend reward settings note:", e);
        }

        // 2. Fetch customer points directly from backend DB if available
        let fetchedFromDb = false;
        try {
            const userRes = await fetch('/api/customers/details');
            if (userRes.ok) {
                const userData = await userRes.json();
                const cust = userData.data || userData;
                if (cust && (cust.points !== undefined && cust.points !== null)) {
                    totalPoints = parseInt(cust.points);
                    fetchedFromDb = true;
                }
            }
        } catch (e) {}

        // 3. Fallback: Calculate from orders only if DB points could not be fetched
        if (!fetchedFromDb) {
            let orders = [];
            const curUser = JSON.parse(localStorage.getItem('user') || '{}');
            const uid = curUser.user_id ? String(curUser.user_id) : null;
            const storedOrders = uid ? localStorage.getItem(`myOrders_${uid}`) : null;
            if (storedOrders) {
                try { orders = JSON.parse(storedOrders); } catch (e) {}
            }
            
            let calculatedPoints = 0;
            orders.forEach(o => {
                const isCancelled = o.status === 'Cancelled' || o.status === 'ยกเลิกแล้ว';
                if (!isCancelled) {
                    if (o.points_earned) {
                        calculatedPoints += parseInt(o.points_earned);
                    } else {
                        const amount = parseFloat(o.total || o.subtotal || 0);
                        if (amount > 0 && peBaht > 0) {
                            calculatedPoints += Math.floor(amount / peBaht) * peQty;
                        }
                    }
                }
            });
            totalPoints = calculatedPoints;
        }

        pointsDisplay.textContent = Number(totalPoints).toLocaleString();
    }

    async function updateOrderBadges() {
        let orders = getUserOrdersData();
        if (!orders || orders.length === 0) {
            const curUser = JSON.parse(localStorage.getItem('user') || '{}');
            const uid = curUser.user_id ? String(curUser.user_id) : null;
            const storedOrders = uid ? localStorage.getItem(`myOrders_${uid}`) : null;
            if (storedOrders) {
                try {
                    orders = JSON.parse(storedOrders);
                } catch (e) {}
            }
        }

        // Render immediately from cache
        calculateAndSetBadges(orders);

        // Fetch authoritative orders from backend API
        try {
            const res = await fetch('/api/orders');
            if (res.ok) {
                const apiRes = await res.json();
                if (apiRes.data && Array.isArray(apiRes.data)) {
                    const mappedApiOrders = apiRes.data.map(o => {
                        const rawTotal = parseFloat(o.total_amount ?? o.amount ?? o.total ?? 0);
                        const rawShipping = parseFloat(o.shipping_fee || 0);
                        const rawSubtotal = parseFloat(o.subtotal ?? (rawTotal - rawShipping));
                        
                        return {
                            id: o.order_id || o.id,
                            date: o.date || o.order_date || o.created_at || new Date().toISOString(),
                            status: mapStatusToUi(o.status),
                            subtotal: isNaN(rawSubtotal) ? 0 : rawSubtotal,
                            shipping: isNaN(rawShipping) ? 0 : rawShipping,
                            total: isNaN(rawTotal) ? 0 : rawTotal,
                            deliveryMethod: o.company_name || 'Standard Express',
                            paymentMethod: o.payment_method || 'transfer',
                            slipImage: null,
                            slip_image: o.slip_image || null,
                            has_slip: Boolean(o.has_slip || o.slip_image)
                        };
                    });

                    orders = mappedApiOrders;
                    saveUserOrdersData(orders);
                    calculateAndSetBadges(orders);
                }
            }
        } catch (e) {
            console.warn("Profile order badges sync note:", e);
        }
    }

    function isStatusPending(status) {
        const s = String(status || '').toLowerCase().trim();
        return s === '1' || s.includes('pending') || s.includes('unpaid') || s.includes('ที่ต้องชำระ') || s.includes('รอดำเนินการ');
    }

    function isStatusPreparing(status) {
        const s = String(status || '').toLowerCase().trim();
        return s === '2' || s.includes('preparing') || s.includes('processing') || s.includes('paid') || s.includes('กำลังแพ็คสินค้า') || s.includes('ที่ต้องจัดส่ง') || s.includes('จัดเตรียม') || s.includes('กำลังดำเนินการ') || s.includes('แพ็คสินค้า') || s.includes('กำลังเตรียมสินค้า');
    }

    function isStatusShipping(status) {
        const s = String(status || '').toLowerCase().trim();
        return s === '3' || s.includes('shipping') || s.includes('shipped') || s.includes('in transit') || s.includes('transit') || s.includes('กำลังจัดส่ง') || s.includes('ส่งแล้ว') || s.includes('ที่ต้องได้รับ') || s.includes('มอบให้ขนส่งแล้ว');
    }

    function isStatusCompleted(status) {
        const s = String(status || '').toLowerCase().trim();
        return s === '4' || s.includes('completed') || s.includes('success') || s.includes('สำเร็จ') || s.includes('จัดส่งสำเร็จ') || s.includes('ลูกค้าได้รับสินค้า');
    }

    function mapStatusToUi(status) {
        if (status === null || status === undefined) return 'Pending Payment';
        if (isStatusPending(status)) return 'Pending Payment';
        if (isStatusPreparing(status)) return 'Preparing';
        if (isStatusShipping(status)) return 'Shipping';
        if (isStatusCompleted(status)) return 'Completed';
        return 'Pending Payment';
    }

    function calculateAndSetBadges(orderList) {
        let pendingCount = 0;
        let preparingCount = 0;
        let shippingCount = 0;

        (orderList || []).forEach(o => {
            if (isStatusPending(o.status)) {
                pendingCount++;
            } else if (isStatusPreparing(o.status)) {
                preparingCount++;
            } else if (isStatusShipping(o.status)) {
                shippingCount++;
            }
        });

        setBadge(badgePendingPayment, pendingCount, 'bg-amber-500');
        setBadge(badgePreparing, preparingCount, 'bg-blue-500');
        setBadge(badgeShipping, shippingCount, 'bg-purple-500');
    }

    function setBadge(element, count, activeBgClass) {
        if (!element) return;
        element.textContent = count > 99 ? '99+' : count;
        
        // Remove old classes
        element.classList.remove('bg-gray-300', 'text-gray-600', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'scale-110', 'animate-pulse');
        
        if (count > 0) {
            element.classList.add(activeBgClass, 'text-white', 'scale-100');
        } else {
            element.classList.add('bg-gray-300', 'text-white', 'opacity-80');
        }
    }

    function updateAvatarDisplays(src) {
        const navProfileImage = document.getElementById('navProfileImage');
        const navDefaultAvatar = document.getElementById('navDefaultAvatar');

        if (src) {
            if (profileImage) {
                profileImage.src = src;
                profileImage.classList.remove('hidden');
            }
            if (defaultAvatar) defaultAvatar.classList.add('hidden');

            if (modalProfileImage) {
                modalProfileImage.src = src;
                modalProfileImage.classList.remove('hidden');
            }
            if (modalDefaultAvatar) modalDefaultAvatar.classList.add('hidden');

            if (navProfileImage) {
                navProfileImage.src = src;
                navProfileImage.classList.remove('hidden');
            }
            if (navDefaultAvatar) navDefaultAvatar.classList.add('hidden');
        } else {
            if (profileImage) profileImage.classList.add('hidden');
            if (defaultAvatar) defaultAvatar.classList.remove('hidden');

            if (modalProfileImage) modalProfileImage.classList.add('hidden');
            if (modalDefaultAvatar) modalDefaultAvatar.classList.remove('hidden');

            if (navProfileImage) navProfileImage.classList.add('hidden');
            if (navDefaultAvatar) navDefaultAvatar.classList.remove('hidden');
        }
    }

    // 2. Modal Open/Close Controls
    async function openModal() {
        await loadProfile(); // ensure inputs match latest saved from backend DB
        if (editProfileModal) {
            editProfileModal.classList.remove('opacity-0', 'pointer-events-none');
            const card = editProfileModal.querySelector('div');
            if (card) {
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }
        }
    }

    function closeModal() {
        if (editProfileModal) {
            const card = editProfileModal.querySelector('div');
            if (card) {
                card.classList.remove('scale-100');
                card.classList.add('scale-95');
            }
            editProfileModal.classList.add('opacity-0', 'pointer-events-none');
        }
    }

    if (openEditModalBtn) openEditModalBtn.addEventListener('click', openModal);
    if (openEditModalMenuBtn) openEditModalMenuBtn.addEventListener('click', openModal);
    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeModal);

    if (editProfileModal) {
        editProfileModal.addEventListener('click', (e) => {
            if (e.target === editProfileModal) closeModal();
        });
    }

    // 3. Image Upload Handler
    if (profileImageInput) {
        profileImageInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    showToast("กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น", "error");
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(event) {
                    tempImageSrc = event.target.result;
                    updateAvatarDisplays(tempImageSrc);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 4. Save Profile Action
    if (saveProfileModalBtn) {
        saveProfileModalBtn.addEventListener('click', async () => {
            const nameVal = inputName.value.trim();
            const phoneVal = inputPhone.value.trim();
            const addressVal = inputAddress.value.trim();

            if (!nameVal) {
                showToast("กรุณากรอกชื่อ-นามสกุล", "error");
                inputName.focus();
                return;
            }
            if (!phoneVal) {
                showToast("กรุณากรอกเบอร์โทรศัพท์", "error");
                inputPhone.focus();
                return;
            }

            const currentProfile = getUserProfileData();
            const finalImage = tempImageSrc || currentProfile.profileImage || '';

            // Save to localStorage
            const userData = {
                name: nameVal,
                address: addressVal,
                province: inputProvince.value.trim(),
                zipcode: inputZipcode.value.trim(),
                phone: phoneVal,
                email: inputEmail.value.trim(),
                profileImage: finalImage
            };

            saveUserProfileData(userData);

            // Also update global user object if needed
            const userObj = JSON.parse(localStorage.getItem('user') || '{}');
            userObj.username = nameVal;
            userObj.first_name = nameVal;
            userObj.phone = phoneVal;
            userObj.email = inputEmail.value.trim();
            userObj.address = addressVal;
            userObj.profile_image = finalImage;
            userObj.profileImage = finalImage;
            localStorage.setItem('user', JSON.stringify(userObj));

            // Sync with backend database
            try {
                const csrfToken = userObj.csrf_token || localStorage.getItem('csrf_token') || '';
                const headers = { 'Content-Type': 'application/json' };
                if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

                await fetch('/api/customers/update', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        customer_id: userObj.customer_id,
                        first_name: nameVal,
                        phone: phoneVal,
                        email: inputEmail.value.trim(),
                        address: addressVal,
                        province: inputProvince.value.trim(),
                        zipcode: inputZipcode.value.trim()
                    })
                });
            } catch (e) {
                console.error("Backend profile sync error:", e);
            }

            // Update Page Header UI
            if (displayName) displayName.textContent = nameVal;
            updateAvatarDisplays(finalImage);

            showToast("บันทึกข้อมูลส่วนตัวสำเร็จ!", "success");
            closeModal();
        });
    }

    // 5. Main Logout Button
    if (mainLogoutBtn) {
        mainLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await performLogout();
        });
    }

    // Initialize
    loadProfile();

    window.addEventListener('storage', updateOrderBadges);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
    initProfilePage();
}
