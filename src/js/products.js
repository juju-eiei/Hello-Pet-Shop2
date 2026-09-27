import { showToast, escapeHTML, getCartData, saveCartData, showRegisterPrompt, performLogout } from './utils.js';
import { updateGlobalCartCount } from './main.js';
import { getPersonalizedProducts, trackSearchQuery, trackAddToCart } from './recommendationEngine.js';

export function initProductsPage() {
    const cleanPath = (window.location.pathname || '').toLowerCase();
    if (cleanPath.includes('/staff') || cleanPath.includes('/admin') || cleanPath.includes('staff_') || cleanPath.includes('admin_')) return;
    const productGrid = document.getElementById('productGrid');
    if (!productGrid) return;

    const productSearch = document.getElementById('productSearch');
    const categoryBtns = document.querySelectorAll('.category-btn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    let allProducts = [];
    let currentCategory = 'all';
    let currentModalProduct = null;
    let currentPage = 1;

    function getItemsPerPage() {
        if (window.innerWidth >= 1024) return 15; // 5 columns * 3 rows
        if (window.innerWidth >= 768) return 9;   // 3 columns * 3 rows
        return 6;                                 // 2 columns * 3 rows
    }

    // 1. Fetch Products
    async function fetchProducts() {
        try {
            const response = await fetch('/api/products');
            const result = await response.json();
            
            if (response.ok) {
                allProducts = result.data || [];
                renderRecommendedProducts();
                renderProducts();

                // Check if URL has ?id=... to auto-open product modal
                const urlParams = new URLSearchParams(window.location.search);
                const urlProductId = urlParams.get('id');
                if (urlProductId) {
                    openProductModal(urlProductId);
                }
            } else {
                showToast("โหลดสินค้าไม่สำเร็จ", "error");
            }
        } catch (error) {
            console.error("Error fetching products:", error);
            showToast("การเชื่อมต่อมีปัญหา", "error");
        }
    }

    // Helper: Attach click & add-to-cart handlers to any product container
    function attachCardEvents(container) {
        if (!container) return;

        // Card click -> open detail modal
        container.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.add-to-cart-btn') || e.target.closest('button[disabled]')) return;
                const productId = card.dataset.id;
                if (productId) {
                    openProductModal(productId);
                }
            });
        });

        // Add-to-cart button click
        container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();

                const user = JSON.parse(localStorage.getItem('user'));
                if (!user) {
                    showRegisterPrompt('กรุณาสมัครสมาชิกเพื่อสั่งซื้อสินค้า');
                    return;
                }

                const { id, name, price, image, category, weight, weightUnit } = e.currentTarget.dataset;
                let parsedWeight = parseFloat(weight) || 0;
                const u = (weightUnit || 'kg').toLowerCase().trim();
                if (u === 'g' || u === 'ml' || u === 'กรัม' || u === 'มิลลิลิตร') {
                    parsedWeight = parsedWeight / 1000.0;
                }
                addToCart({ 
                    id, 
                    name, 
                    price, 
                    image, 
                    category_name: category,
                    weight: parsedWeight,
                    weight_unit: weightUnit || 'kg'
                }, 1);
            });
        });
    }

    // 2. Render Recommended Products (Single Horizontal Row)
    function renderRecommendedProducts() {
        const recommendedScroll = document.getElementById('recommendedScroll');
        const recSection = document.getElementById('recommendedSection');
        const recScrollLeft = document.getElementById('recScrollLeft');
        const recScrollRight = document.getElementById('recScrollRight');

        if (!recommendedScroll || !recSection) return;

        const recommendedList = getPersonalizedProducts(allProducts);
        if (!recommendedList || recommendedList.length === 0) {
            recSection.style.display = 'none';
            return;
        }

        recSection.style.display = 'block';

        let myPets = [];
        try {
            const cachedPets = localStorage.getItem('myPetsData');
            if (cachedPets) myPets = JSON.parse(cachedPets);
            if (!Array.isArray(myPets) || myPets.length === 0) {
                const fallback = localStorage.getItem('myPets');
                if (fallback) myPets = JSON.parse(fallback);
            }
        } catch(e) {}

        const hasPets = Array.isArray(myPets) && myPets.length > 0;
        let addPetCardHTML = '';
        if (!hasPets) {
            addPetCardHTML = `
            <div class="add-pet-card cursor-pointer relative flex flex-col justify-between flex-shrink-0 w-44 sm:w-48 md:w-52 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 rounded-3xl p-4 border-2 border-dashed border-emerald-300 shadow-sm hover:shadow-md transition-all text-center group" onclick="window.location.href='/my-pets.html'">
                <div class="flex flex-col items-center justify-center my-auto py-2">
                    <div class="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md text-emerald-600 mb-3 group-hover:scale-110 transition-transform">
                        <i class="fas fa-paw text-2xl"></i>
                    </div>
                    <h4 class="text-xs sm:text-sm font-extrabold text-emerald-900 mb-1">เพิ่มสัตว์เลี้ยงของคุณ</h4>
                    <p class="text-[11px] text-emerald-700 leading-tight">รับคำแนะนำสินค้าที่เหมาะกับน้องมากที่สุด</p>
                </div>
                <button class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer">
                    <i class="fas fa-plus-circle"></i> เพิ่มสัตว์เลี้ยง
                </button>
            </div>`;
        }

        recommendedScroll.innerHTML = addPetCardHTML + recommendedList.map(p => {
            const stockQty = p.stock_qty !== null && p.stock_qty !== undefined ? parseInt(p.stock_qty) : null;
            const isOutOfStock = stockQty !== null && stockQty <= 0;
            const badgeBg = p.isPetMatch ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-600 to-red-500';
            const badgeText = p.aiReason || 'สินค้าแนะนำ';

            return `
            <div class="product-card group cursor-pointer relative flex flex-col justify-between flex-shrink-0 w-44 sm:w-48 md:w-52 bg-white rounded-3xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-all" data-id="${escapeHTML(p.product_id)}">
                <div class="product-card-body">
                    <div class="relative aspect-square bg-[#f8f9fa] rounded-2xl overflow-hidden mb-3 shadow-xs group-hover:shadow-sm transition-all">
                        <div class="absolute top-2 left-2 z-10 ${badgeBg} text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-md">
                            <span>${escapeHTML(badgeText)}</span>
                        </div>
                        ${isOutOfStock ? `
                            <div class="absolute top-2 right-2 z-10 bg-gray-800/80 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                                หมด
                            </div>
                        ` : ''}
                        <img src="${escapeHTML(p.image_url || '/image/non-image.png')}" 
                            alt="${escapeHTML(p.product_name)}" 
                            onerror="this.src='/image/non-image.png'"
                            class="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500">
                    </div>
                    <div class="text-center px-1">
                        <h3 class="text-xs sm:text-sm font-semibold text-gray-800 mb-1 leading-tight h-9 line-clamp-2 group-hover:text-secondary-600 transition-colors">${escapeHTML(p.product_name)}</h3>
                        <p class="text-secondary-600 font-extrabold text-sm sm:text-base mb-2">฿${parseFloat(p.selling_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                </div>
                <div>
                    ${isOutOfStock ? `
                        <button class="w-full py-2 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed" disabled>
                            <i class="fas fa-ban"></i> สินค้าหมด
                        </button>
                    ` : `
                        <button class="add-to-cart-btn w-full py-2 bg-secondary-600 hover:bg-secondary-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            data-id="${escapeHTML(p.product_id)}" 
                            data-name="${escapeHTML(p.product_name)}" 
                            data-price="${escapeHTML(p.selling_price)}" 
                            data-image="${escapeHTML(p.image_url || '/image/non-image.png')}" 
                            data-category="${escapeHTML(p.category_name || '')}"
                            data-weight="${escapeHTML(p.weight || p.weight_value || '0')}"
                            data-weight-unit="${escapeHTML(p.weight_unit || 'kg')}">
                            <i class="fas fa-cart-plus"></i> หยิบใส่ตะกร้า
                        </button>
                    `}
                </div>
            </div>
        `;
        }).join('');

        attachCardEvents(recommendedScroll);

        // Arrow buttons navigation
        if (recScrollLeft) {
            recScrollLeft.onclick = () => recommendedScroll.scrollBy({ left: -260, behavior: 'smooth' });
        }
        if (recScrollRight) {
            recScrollRight.onclick = () => recommendedScroll.scrollBy({ left: 260, behavior: 'smooth' });
        }

        // Mouse drag-to-scroll for desktop
        if (!recommendedScroll.dataset.dragInit) {
            recommendedScroll.dataset.dragInit = 'true';
            let isDown = false;
            let startX = 0;
            let scrollStart = 0;
            let hasDragged = false;

            recommendedScroll.addEventListener('mousedown', (e) => {
                isDown = true;
                hasDragged = false;
                recommendedScroll.classList.add('cursor-grabbing');
                startX = e.pageX - recommendedScroll.offsetLeft;
                scrollStart = recommendedScroll.scrollLeft;
            });

            window.addEventListener('mouseup', () => {
                if (isDown) {
                    isDown = false;
                    recommendedScroll.classList.remove('cursor-grabbing');
                }
            });

            recommendedScroll.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - recommendedScroll.offsetLeft;
                const walk = (x - startX) * 1.5;
                if (Math.abs(walk) > 5) hasDragged = true;
                recommendedScroll.scrollLeft = scrollStart - walk;
            });

            recommendedScroll.addEventListener('click', (e) => {
                if (hasDragged) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true);
        }
    }

    function matchesPetOrCategory(p, filterVal) {
        if (!filterVal || filterVal.toLowerCase() === 'all') return true;
        const val = filterVal.toLowerCase().trim();

        const petCode = (p.target_pet_type_code || '').toLowerCase().trim();
        const petName = (p.target_pet_type_name || '').toLowerCase().trim();
        const catName = (p.category_name || '').toLowerCase().trim();

        const petMap = {
            'dog': ['dog', 'สุนัข', 'หมา'],
            'cat': ['cat', 'แมว'],
            'bird': ['bird', 'นก'],
            'hamster': ['hamster', 'แฮมสเตอร์', 'หนู'],
            'rabbit': ['rabbit', 'กระต่าย'],
            'squirrel': ['squirrel', 'กระรอก']
        };

        const targetKeywords = petMap[val] || [val];

        for (const kw of targetKeywords) {
            if (petCode === kw || petName.includes(kw) || catName.includes(kw)) {
                return true;
            }
        }
        return false;
    }

    // 3. Render All Products (Filtered by Category & Search + 3 Rows Pagination)
    function renderProducts() {
        const rawValue = productSearch ? productSearch.value : '';
        const query = rawValue.trim().toLowerCase();
        
        // Hide recommended row when searching to let search results stand out
        const recSection = document.getElementById('recommendedSection');
        if (recSection) {
            recSection.style.display = query ? 'none' : 'block';
        }

        const displayList = allProducts.filter(p => {
            const matchesSearch = !query || 
                (p.product_name || '').toLowerCase().includes(query) ||
                (p.category_name || '').toLowerCase().includes(query) ||
                (p.target_pet_type_name || '').toLowerCase().includes(query);
            const matchesCategory = matchesPetOrCategory(p, currentCategory);
            return matchesSearch && matchesCategory;
        });

        const paginationContainer = document.getElementById('productPagination');

        if (displayList.length === 0) {
            productGrid.innerHTML = `
                <div class="col-span-full py-20 text-center text-gray-500">
                    <i class="fas fa-box-open text-4xl mb-4 block text-gray-300"></i>
                    ไม่พบสินค้าที่ตรงกับการค้นหา
                </div>
            `;
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        const itemsPerPage = getItemsPerPage();
        const totalPages = Math.ceil(displayList.length / itemsPerPage);
        if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedList = displayList.slice(startIndex, startIndex + itemsPerPage);

        productGrid.innerHTML = paginatedList.map(p => {
            const stockQty = p.stock_qty !== null && p.stock_qty !== undefined ? parseInt(p.stock_qty) : null;
            const isOutOfStock = stockQty !== null && stockQty <= 0;

            return `
            <div class="product-card group cursor-pointer relative flex flex-col justify-between" data-id="${escapeHTML(p.product_id)}">
                <div class="product-card-body">
                    <div class="relative aspect-square bg-[#f8f9fa] rounded-3xl overflow-hidden mb-4 shadow-sm group-hover:shadow-md transition-all">
                        ${isOutOfStock ? `
                            <div class="absolute top-2 right-2 z-10 bg-gray-800/80 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                                หมด
                            </div>
                        ` : ''}
                        <img src="${escapeHTML(p.image_url || '/image/non-image.png')}" 
                            alt="${escapeHTML(p.product_name)}" 
                            onerror="this.src='/image/non-image.png'"
                            class="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500">
                    </div>
                    <div class="text-center px-1">
                        <h3 class="text-sm font-semibold text-gray-800 mb-1 leading-tight h-10 line-clamp-2 group-hover:text-secondary-600 transition-colors">${escapeHTML(p.product_name)}</h3>
                        <p class="text-secondary-600 font-extrabold text-base mb-3">฿${parseFloat(p.selling_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                    </div>
                </div>
                <div>
                    ${isOutOfStock ? `
                        <button class="w-full py-2.5 bg-gray-200 text-gray-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed" disabled>
                            <i class="fas fa-ban"></i> สินค้าหมด
                        </button>
                    ` : `
                        <button class="add-to-cart-btn w-full py-2.5 bg-secondary-600 hover:bg-secondary-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            data-id="${escapeHTML(p.product_id)}" 
                            data-name="${escapeHTML(p.product_name)}" 
                            data-price="${escapeHTML(p.selling_price)}" 
                            data-image="${escapeHTML(p.image_url || '/image/non-image.png')}" 
                            data-category="${escapeHTML(p.category_name || '')}"
                            data-weight="${escapeHTML(p.weight || p.weight_value || '0')}"
                            data-weight-unit="${escapeHTML(p.weight_unit || 'kg')}">
                            <i class="fas fa-cart-plus"></i> หยิบใส่ตะกร้า
                        </button>
                    `}
                </div>
            </div>
        `;
        }).join('');

        attachCardEvents(productGrid);
        renderPagination(displayList.length);
    }

    function renderPagination(totalItems) {
        const paginationContainer = document.getElementById('productPagination');
        if (!paginationContainer) return;

        const itemsPerPage = getItemsPerPage();
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '';

        // Prev Button
        if (currentPage > 1) {
            html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all duration-200 shadow-sm bg-white text-gray-700 border border-gray-200 hover:bg-secondary-50 hover:border-secondary-300 hover:text-secondary-700 active:scale-95 cursor-pointer" onclick="window.changeProductsPage(${currentPage - 1})" aria-label="Previous page"><i class="fas fa-chevron-left text-xs"></i></button>`;
        } else {
            html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm border border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed" disabled><i class="fas fa-chevron-left text-xs"></i></button>`;
        }

        // Page Numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = startPage + maxVisiblePages - 1;

        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-200 shadow-sm bg-white text-gray-700 border border-gray-200 hover:bg-secondary-50 hover:border-secondary-300 hover:text-secondary-700 active:scale-95 cursor-pointer" onclick="window.changeProductsPage(1)">1</button>`;
            if (startPage > 2) {
                html += `<span class="w-6 text-center text-gray-400 font-bold">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-secondary-600 text-white shadow-md scale-105 pointer-events-none">${i}</button>`;
            } else {
                html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-200 shadow-sm bg-white text-gray-700 border border-gray-200 hover:bg-secondary-50 hover:border-secondary-300 hover:text-secondary-700 active:scale-95 cursor-pointer" onclick="window.changeProductsPage(${i})">${i}</button>`;
            }
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="w-6 text-center text-gray-400 font-bold">...</span>`;
            }
            html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-200 shadow-sm bg-white text-gray-700 border border-gray-200 hover:bg-secondary-50 hover:border-secondary-300 hover:text-secondary-700 active:scale-95 cursor-pointer" onclick="window.changeProductsPage(${totalPages})">${totalPages}</button>`;
        }

        // Next Button
        if (currentPage < totalPages) {
            html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all duration-200 shadow-sm bg-white text-gray-700 border border-gray-200 hover:bg-secondary-50 hover:border-secondary-300 hover:text-secondary-700 active:scale-95 cursor-pointer" onclick="window.changeProductsPage(${currentPage + 1})" aria-label="Next page"><i class="fas fa-chevron-right text-xs"></i></button>`;
        } else {
            html += `<button type="button" class="w-10 h-10 rounded-xl flex items-center justify-center text-sm border border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed" disabled><i class="fas fa-chevron-right text-xs"></i></button>`;
        }

        paginationContainer.innerHTML = html;
    }

    window.changeProductsPage = function(page) {
        currentPage = page;
        renderProducts();
        const section = document.getElementById('allProductsSection');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // 3. Add to Cart with Behavior Tracking
    function addToCart(product, quantityToAdd = 1) {
        const qty = Math.max(1, parseInt(quantityToAdd) || 1);
        let cart = getCartData();
        const existing = cart.find(item => String(item.id) === String(product.id));
        
        if (existing) {
            existing.quantity += qty;
        } else {
            cart.push({ ...product, quantity: qty });
        }
        
        saveCartData(cart);
        updateGlobalCartCount();
        
        // Track Add to Cart for AI Model
        trackAddToCart(product);

        const qtyText = qty > 1 ? ` (${qty} ชิ้น)` : '';
        showToast(`เพิ่ม ${product.name}${qtyText} ลงในตะกร้าแล้ว`, "success");
    }

    // 4. Product Detail Modal Operations
    async function openProductModal(productId) {
        if (!productId) return;
        let product = allProducts.find(p => String(p.product_id) === String(productId));

        // If not loaded in in-memory array, fetch from API
        if (!product) {
            try {
                const res = await fetch(`/api/products?id=${productId}`);
                if (res.ok) {
                    const result = await res.json();
                    product = result.data;
                }
            } catch (err) {
                console.error("Error fetching single product:", err);
            }
        }

        if (!product) {
            showToast("ไม่พบข้อมูลสินค้า", "error");
            return;
        }

        currentModalProduct = product;

        const modal = document.getElementById('productDetailModal');
        const dialog = document.getElementById('productDetailDialog');
        if (!modal || !dialog) return;

        // Image
        const img = document.getElementById('modalProductImage');
        if (img) {
            img.src = product.image_url || '/image/non-image.png';
            img.alt = product.product_name || 'สินค้า';
        }

        // AI Badge
        const aiBadge = document.getElementById('modalAiBadge');
        const aiText = document.getElementById('modalAiBadgeText');
        if (aiBadge && aiText) {
            if (product.aiReason) {
                aiText.textContent = product.aiReason;
                aiBadge.classList.remove('hidden');
                aiBadge.classList.add('flex');
            } else {
                aiBadge.classList.add('hidden');
                aiBadge.classList.remove('flex');
            }
        }

        // Category
        const catBadge = document.getElementById('modalProductCategory');
        if (catBadge) {
            catBadge.textContent = product.category_name || 'สินค้าทั่วไป';
        }

        // Name
        const nameEl = document.getElementById('modalProductName');
        if (nameEl) {
            nameEl.textContent = product.product_name || '';
        }

        // Price
        const priceEl = document.getElementById('modalProductPrice');
        if (priceEl) {
            priceEl.textContent = `฿${parseFloat(product.selling_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        // Stock Status
        const stockQty = product.stock_qty !== null && product.stock_qty !== undefined ? parseInt(product.stock_qty) : null;
        const isOutOfStock = stockQty !== null && stockQty <= 0;
        const stockBadge = document.getElementById('modalProductStockBadge');
        const qtySection = document.getElementById('modalQtySection');
        const qtyInput = document.getElementById('modalQtyInput');
        const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');

        if (stockBadge) {
            if (isOutOfStock) {
                stockBadge.className = 'px-3 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200 flex items-center gap-1';
                stockBadge.innerHTML = '<i class="fas fa-times-circle text-red-500"></i> สินค้าหมดชั่วคราว';
            } else {
                stockBadge.className = 'px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1';
                const stockText = stockQty !== null ? `มีสินค้า (${stockQty} ชิ้น)` : 'มีสินค้าพร้อมส่ง';
                stockBadge.innerHTML = `<i class="fas fa-check-circle text-emerald-500"></i> ${stockText}`;
            }
        }

        // Weight / Volume
        const weightVal = product.weight_value !== null && product.weight_value !== undefined && product.weight_value !== '' 
            ? product.weight_value 
            : (product.weight || null);
        const weightContainer = document.getElementById('modalProductWeightContainer');
        const weightEl = document.getElementById('modalProductWeight');
        if (weightContainer && weightEl) {
            if (weightVal) {
                weightEl.textContent = `${weightVal} ${product.weight_unit || 'kg'}`;
                weightContainer.classList.remove('hidden');
            } else {
                weightContainer.classList.add('hidden');
            }
        }

        // Description
        const descEl = document.getElementById('modalProductDesc');
        if (descEl) {
            const desc = (product.description || '').trim();
            descEl.textContent = desc || 'ไม่มีรายละเอียดเพิ่มเติมสำหรับสินค้านี้';
        }

        // Stepper & Add to Cart button state
        if (qtyInput) {
            qtyInput.value = '1';
            qtyInput.max = stockQty !== null && stockQty > 0 ? stockQty : 999;
        }

        if (modalAddToCartBtn && qtySection) {
            if (isOutOfStock) {
                qtySection.classList.add('opacity-40', 'pointer-events-none');
                modalAddToCartBtn.disabled = true;
                modalAddToCartBtn.className = 'w-full py-3.5 px-6 bg-gray-200 text-gray-400 font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed text-sm sm:text-base';
                modalAddToCartBtn.innerHTML = '<i class="fas fa-ban"></i> <span>สินค้าหมดชั่วคราว</span>';
            } else {
                qtySection.classList.remove('opacity-40', 'pointer-events-none');
                modalAddToCartBtn.disabled = false;
                modalAddToCartBtn.className = 'w-full py-3.5 px-6 bg-secondary-600 hover:bg-secondary-700 active:scale-98 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer';
                modalAddToCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> <span>เพิ่มลงในตะกร้า</span>';
            }
        }

        // Show Modal
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.classList.add('opacity-100', 'pointer-events-auto');
        dialog.classList.remove('scale-95');
        dialog.classList.add('scale-100');
        document.body.style.overflow = 'hidden';

        // Update URL query param without reload
        try {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('id', product.product_id);
            window.history.replaceState({}, '', currentUrl);
        } catch (e) {}
    }

    function closeProductModal() {
        const modal = document.getElementById('productDetailModal');
        const dialog = document.getElementById('productDetailDialog');
        if (!modal || !dialog) return;

        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.classList.remove('opacity-100', 'pointer-events-auto');
        dialog.classList.add('scale-95');
        dialog.classList.remove('scale-100');
        document.body.style.overflow = '';
        currentModalProduct = null;

        // Clean URL query param without reload
        try {
            const currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.has('id')) {
                currentUrl.searchParams.delete('id');
                window.history.replaceState({}, '', currentUrl);
            }
        } catch (e) {}
    }

    function setupProductModalEvents() {
        const modal = document.getElementById('productDetailModal');
        const closeBtn = document.getElementById('closeProductModalBtn');
        const qtyDecreaseBtn = document.getElementById('modalQtyDecreaseBtn');
        const qtyIncreaseBtn = document.getElementById('modalQtyIncreaseBtn');
        const qtyInput = document.getElementById('modalQtyInput');
        const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');

        if (!modal) return;

        if (closeBtn) {
            closeBtn.onclick = closeProductModal;
        }

        // Click on backdrop to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeProductModal();
            }
        };

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('opacity-100')) {
                closeProductModal();
            }
        });

        // Stepper
        if (qtyDecreaseBtn && qtyInput) {
            qtyDecreaseBtn.onclick = () => {
                let val = parseInt(qtyInput.value) || 1;
                if (val > 1) {
                    qtyInput.value = val - 1;
                }
            };
        }

        if (qtyIncreaseBtn && qtyInput) {
            qtyIncreaseBtn.onclick = () => {
                let val = parseInt(qtyInput.value) || 1;
                let max = parseInt(qtyInput.max) || 999;
                if (val < max) {
                    qtyInput.value = val + 1;
                } else {
                    showToast(`มีสินค้าในสต็อกสูงสุด ${max} ชิ้น`, "info");
                }
            };
        }

        if (qtyInput) {
            qtyInput.onchange = () => {
                let val = parseInt(qtyInput.value) || 1;
                let max = parseInt(qtyInput.max) || 999;
                if (val < 1) val = 1;
                if (val > max) {
                    val = max;
                    showToast(`มีสินค้าในสต็อกสูงสุด ${max} ชิ้น`, "info");
                }
                qtyInput.value = val;
            };
        }

        // Add to cart from modal
        if (modalAddToCartBtn) {
            modalAddToCartBtn.onclick = () => {
                if (!currentModalProduct) return;

                // Check login
                const user = JSON.parse(localStorage.getItem('user'));
                if (!user) {
                    showRegisterPrompt('กรุณาสมัครสมาชิกเพื่อสั่งซื้อสินค้า');
                    return;
                }

                let parsedWeight = parseFloat(currentModalProduct.weight || currentModalProduct.weight_value || '0') || 0;
                const u = (currentModalProduct.weight_unit || 'kg').toLowerCase().trim();
                if (u === 'g' || u === 'ml' || u === 'กรัม' || u === 'มิลลิลิตร') {
                    parsedWeight = parsedWeight / 1000.0;
                }

                const qty = parseInt(qtyInput ? qtyInput.value : 1) || 1;

                addToCart({
                    id: currentModalProduct.product_id,
                    name: currentModalProduct.product_name,
                    price: currentModalProduct.selling_price,
                    image: currentModalProduct.image_url || '/image/non-image.png',
                    category_name: currentModalProduct.category_name,
                    weight: parsedWeight,
                    weight_unit: currentModalProduct.weight_unit || 'kg'
                }, qty);

                // Quick visual feedback
                modalAddToCartBtn.innerHTML = '<i class="fas fa-check"></i> <span>เพิ่มลงในตะกร้าแล้ว!</span>';
                setTimeout(() => {
                    closeProductModal();
                }, 400);
            };
        }
    }

    // 4. Promo Banner Carousel (Dynamic from Backend API)
    async function initPromoCarousel() {
        const promoSlides = document.getElementById('promoSlides');
        const promoDotsContainer = document.getElementById('promoDots');
        const prevBtn = document.getElementById('promoPrevBtn');
        const nextBtn = document.getElementById('promoNextBtn');
        const carousel = document.getElementById('promoCarousel');

        if (!promoSlides || !promoDotsContainer) return;

        // Fetch active banners dynamically from backend
        let banners = [];
        try {
            const res = await fetch('/api/banners');
            if (res.ok) {
                const data = await res.json();
                banners = data.data || [];
            }
        } catch (e) {
            console.error('Failed to load dynamic banners:', e);
        }

        // Fallback default banners if none in DB
        if (banners.length === 0) {
            banners = [
                { title: 'โปรโมชั่น New Arrivals', image_url: '/images/promotions/promo1.png', link_url: '' },
                { title: 'ส่วนลดพิเศษประจำเดือน', image_url: '/images/promotions/promo2.png', link_url: '' },
                { title: 'อาหารสัตว์เลี้ยงพรีเมียม', image_url: '/images/promotions/promo3.png', link_url: '' }
            ];
        }

        // Render dynamic slides
        promoSlides.innerHTML = banners.map((b) => `
            <div class="w-full flex-shrink-0 relative ${b.link_url ? 'cursor-pointer' : ''}" ${b.link_url ? `onclick="(window.navigateTo ? window.navigateTo('${escapeHTML(b.link_url)}') : window.location.href='${escapeHTML(b.link_url)}')"` : ''}>
                <div class="w-full h-48 sm:h-64 md:h-80 relative overflow-hidden">
                    <img src="${escapeHTML(b.image_url)}" alt="${escapeHTML(b.title || 'โปรโมชั่น')}" 
                        class="w-full h-full object-cover"
                        onerror="this.src='/images/promotions/promo1.png'">
                </div>
            </div>
        `).join('');

        // Render dynamic dots
        promoDotsContainer.innerHTML = banners.map((_, idx) => `
            <button class="promo-dot w-2.5 h-2.5 rounded-full bg-white/50 transition-all duration-300 focus:outline-none" data-slide="${idx}" aria-label="Slide ${idx + 1}"></button>
        `).join('');

        const promoDots = document.querySelectorAll('.promo-dot');
        let currentSlide = 0;
        const totalSlides = banners.length;
        let slideInterval;

        function goToSlide(index) {
            currentSlide = (index + totalSlides) % totalSlides;
            promoSlides.style.transform = `translateX(-${currentSlide * 100}%)`;

            promoDots.forEach((dot, idx) => {
                if (idx === currentSlide) {
                    dot.classList.remove('bg-white/50', 'w-2.5');
                    dot.classList.add('bg-white', 'w-6');
                } else {
                    dot.classList.remove('bg-white', 'w-6');
                    dot.classList.add('bg-white/50', 'w-2.5');
                }
            });
        }

        function startAutoSlide() {
            stopAutoSlide();
            if (totalSlides > 1) {
                slideInterval = setInterval(() => {
                    goToSlide(currentSlide + 1);
                }, 4000);
            }
        }

        function stopAutoSlide() {
            if (slideInterval) clearInterval(slideInterval);
        }

        if (prevBtn) {
            prevBtn.onclick = () => {
                goToSlide(currentSlide - 1);
                startAutoSlide();
            };
        }

        if (nextBtn) {
            nextBtn.onclick = () => {
                goToSlide(currentSlide + 1);
                startAutoSlide();
            };
        }

        promoDots.forEach((dot, idx) => {
            dot.onclick = () => {
                goToSlide(idx);
                startAutoSlide();
            };
        });

        if (carousel) {
            carousel.onmouseenter = stopAutoSlide;
            carousel.onmouseleave = startAutoSlide;
        }

        goToSlide(0);
        startAutoSlide();
    }

    // 5. Search Input Handler with Behavior Tracking
    let searchDebounce = null;
    if (productSearch) {
        productSearch.addEventListener('input', (e) => {
            currentPage = 1;
            renderProducts();
            
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                const query = e.target.value.trim();
                if (query.length >= 2) {
                    trackSearchQuery(query);
                }
            }, 600);
        });

        productSearch.addEventListener('change', () => {
            currentPage = 1;
            renderProducts();
        });

        productSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                currentPage = 1;
                renderProducts();
            }
        });
    }

    // 6. Dynamic Pet Type / Category Filter Tabs Loader
    async function loadPetTypeFilterTabs() {
        const filterContainer = document.getElementById('categoryFilterContainer');
        if (!filterContainer) return;

        try {
            const res = await fetch('/api/pet-types');
            if (res.ok) {
                const result = await res.json();
                let petTypes = result.data || [];
                
                // Exclude 'all' / 'สัตว์ทุกประเภท' since "ทั้งหมด" is the base default button
                petTypes = petTypes.filter(pt => {
                    const code = (pt.code || '').toLowerCase().trim();
                    const name = (pt.name || '').toLowerCase().trim();
                    return code !== 'all' && !name.includes('สัตว์ทุกประเภท');
                });

                if (petTypes.length > 0) {
                    let html = `
                        <button
                            class="category-btn ${currentCategory === 'all' ? 'active bg-secondary-200 font-bold' : 'search-blue font-medium hover:bg-secondary-100'} px-4 py-2 text-gray-800 text-xs sm:text-sm rounded-xl shadow-sm transition-all shrink-0"
                            data-category="all">ทั้งหมด</button>
                    `;

                    petTypes.forEach(pt => {
                        const catKey = (pt.code || pt.name || '').toLowerCase().trim();
                        const isActive = currentCategory.toLowerCase() === catKey;
                        html += `
                            <button
                                class="category-btn ${isActive ? 'active bg-secondary-200 font-bold' : 'search-blue font-medium hover:bg-secondary-100'} px-4 py-2 text-gray-800 text-xs sm:text-sm rounded-xl shadow-sm transition-all shrink-0"
                                data-category="${escapeHTML(catKey)}"
                                data-pet-id="${escapeHTML(String(pt.id || ''))}"
                                data-pet-name="${escapeHTML(pt.name || '')}">
                                ${escapeHTML(pt.name || '')}
                            </button>
                        `;
                    });

                    filterContainer.innerHTML = html;
                }
            }
        } catch (e) {
            console.error("Error fetching pet types for filter:", e);
        }

        bindCategoryTabEvents();
    }

    function bindCategoryTabEvents() {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.category-btn').forEach(b => {
                    b.className = 'category-btn px-4 py-2 search-blue text-gray-800 text-xs sm:text-sm font-medium rounded-xl hover:bg-secondary-100 transition-all shrink-0';
                });

                currentCategory = btn.dataset.category || 'all';
                btn.className = 'category-btn active px-4 py-2 bg-secondary-200 text-gray-800 text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all shrink-0';

                currentPage = 1;
                renderProducts();
            };
        });
    }

    // 7. Responsive Breakpoint Resize Listener
    let lastItemsPerPage = getItemsPerPage();
    window.addEventListener('resize', () => {
        const currentIPP = getItemsPerPage();
        if (currentIPP !== lastItemsPerPage) {
            lastItemsPerPage = currentIPP;
            renderProducts();
        }
    });

    function setupNavbarForGuestOrUser() {
        const user = JSON.parse(localStorage.getItem('user'));
        const userNavActions = document.getElementById('userNavActions');
        const guestNavActions = document.getElementById('guestNavActions');
        const guestCartBtn = document.getElementById('guestCartBtn');

        if (user) {
            if (userNavActions) userNavActions.classList.remove('hidden');
            if (guestNavActions) {
                guestNavActions.classList.add('hidden');
                guestNavActions.classList.remove('flex');
            }
        } else {
            if (userNavActions) userNavActions.classList.add('hidden');
            if (guestNavActions) {
                guestNavActions.classList.remove('hidden');
                guestNavActions.classList.add('flex');
            }

            if (guestCartBtn) {
                guestCartBtn.onclick = (e) => {
                    e.preventDefault();
                    showRegisterPrompt('กรุณาสมัครสมาชิกเพื่อสั่งซื้อสินค้า');
                };
            }

            // Customer restricted links in header
            document.querySelectorAll('.customer-restricted-link').forEach(link => {
                link.onclick = (e) => {
                    e.preventDefault();
                    showRegisterPrompt('กรุณาสมัครสมาชิกเพื่อเข้าใช้งานส่วนนี้');
                };
            });

            // Customer bottom nav in mobile
            document.querySelectorAll('.customer-bottom-nav a').forEach(link => {
                const href = link.getAttribute('href') || '';
                if (!href.includes('products.html')) {
                    link.onclick = (e) => {
                        e.preventDefault();
                        showRegisterPrompt('กรุณาสมัครสมาชิกเพื่อเข้าใช้งานส่วนนี้');
                    };
                }
            });
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await performLogout();
        });
    }

    // Initialize
    setupNavbarForGuestOrUser();
    setupProductModalEvents();
    loadPetTypeFilterTabs();
    fetchProducts();
    initPromoCarousel();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductsPage);
} else {
    initProductsPage();
}

