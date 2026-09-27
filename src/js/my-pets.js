import { showToast, escapeHTML } from './utils.js';

export function initMyPetsPage() {
    const cleanPath = (window.location.pathname || '').toLowerCase();
    if (cleanPath.includes('/staff') || cleanPath.includes('/admin') || cleanPath.includes('staff_') || cleanPath.includes('admin_')) return;
    // DOM Elements
    const petsGrid = document.getElementById('petsGrid');
    if (!petsGrid) return;
    const emptyState = document.getElementById('emptyState');
    const addPetBtn = document.getElementById('addPetBtn');
    
    // Modal Elements
    const petFormModal = document.getElementById('petFormModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelPetBtn = document.getElementById('cancelPetBtn');
    const savePetBtn = document.getElementById('savePetBtn');
    const modalTitle = document.getElementById('modalTitle');
    const petForm = document.getElementById('petForm');
    
    // Form Inputs
    const petIdInput = document.getElementById('petId');
    const petNameInput = document.getElementById('petName');
    const petSpeciesInput = document.getElementById('petSpecies');
    const petBreedInput = document.getElementById('petBreed');
    const petBirthDateInput = document.getElementById('petBirthDate');
    const petWeightInput = document.getElementById('petWeight');
    const petNotesInput = document.getElementById('petNotes');
    const petImageInput = document.getElementById('petImageInput');
    const petImagePreview = document.getElementById('petImagePreview');
    const petImagePlaceholder = document.getElementById('petImagePlaceholder');

    // Delete Modal Elements
    const deleteModal = document.getElementById('deleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const deletePetNameSpan = document.getElementById('deletePetName');

    // State
    let pets = [];
    let currentTempImageSrc = "";
    let petToDeleteId = null;

    // Initialize
    loadPetTypesForSelect();
    loadPets();

    async function loadPetTypesForSelect() {
        try {
            const res = await fetch('/api/pet-types');
            if (res.ok) {
                const result = await res.json();
                if (petSpeciesInput && result.data && result.data.length > 0) {
                    const currentVal = petSpeciesInput.value;
                    petSpeciesInput.innerHTML = '<option value="" disabled selected>เลือกชนิดสัตว์เลี้ยง...</option>' +
                        result.data.filter(pt => pt.code !== 'all').map(pt => `<option value="${escapeHTML(pt.name)}">${escapeHTML(pt.name)}</option>`).join('');
                    if (currentVal) petSpeciesInput.value = currentVal;
                }
            }
        } catch (e) {
            console.error("Error loading pet types for select:", e);
        }
    }

    // =============== Core Functions ===============

    async function loadPets() {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        let customerId = user?.customer_id;

        // 1. Instant Cache Render: If pets data is already in customer-specific cache
        const cacheKey = customerId ? `myPetsData_${customerId}` : 'myPetsData';
        const cachedPetsStr = localStorage.getItem(cacheKey);
        if (cachedPetsStr) {
            try {
                const cached = JSON.parse(cachedPetsStr);
                if (Array.isArray(cached) && cached.length > 0) {
                    pets = cached;
                    renderPets();
                }
            } catch (e) {}
        }
        
        if (!customerId) {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const result = await res.json();
                    if (result.data) {
                        customerId = result.data.customer_id;
                        localStorage.setItem('user', JSON.stringify(result.data));
                    }
                }
            } catch (err) {
                console.error("Error resolving session:", err);
            }
        }
        
        if (customerId) {
            try {
                const res = await fetch(`/api/customers/details?id=${customerId}`);
                if (res.ok) {
                    const result = await res.json();
                    if (result.data && Array.isArray(result.data.pets)) {
                        pets = result.data.pets.map(p => ({
                            id: String(p.pet_id),
                            name: p.pet_name,
                            species: p.pet_type,
                            breed: p.breed || '',
                            birthDate: p.birthdate || '',
                            weight: p.weight || '',
                            notes: p.notes || '',
                            image: p.image_url || '',
                            createdAt: p.created_at || ''
                        }));
                        savePetsToLocal();
                        renderPets();
                        return;
                    }
                }
            } catch (err) {
                console.error("Error loading pets from DB:", err);
            }
        }

        const petsStr = customerId ? localStorage.getItem(`myPetsData_${customerId}`) : localStorage.getItem('myPetsData');
        pets = petsStr ? JSON.parse(petsStr) : [];
        renderPets();
    }

    function savePetsToLocal() {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const customerId = user?.customer_id;
        if (customerId) {
            localStorage.setItem(`myPetsData_${customerId}`, JSON.stringify(pets));
        }
        localStorage.setItem('myPetsData', JSON.stringify(pets));
    }

    function renderPets() {
        petsGrid.innerHTML = '';
        
        if (pets.length === 0) {
            petsGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        petsGrid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        pets.forEach(pet => {
            const ageDisplay = calculateAge(pet.birthDate);
            const imageHtml = pet.image 
                ? `<img src="${escapeHTML(pet.image)}" onerror="this.src='/image/non-image.png'" alt="${escapeHTML(pet.name)}" class="w-full h-full object-cover">`
                : `<i class="fas fa-paw text-gray-300 text-4xl"></i>`;

            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow relative group";
            card.innerHTML = `
                <!-- Action Buttons (Hidden by default, shown on hover/focus) -->
                <div class="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-pet-btn w-8 h-8 rounded-full bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center transition-colors" data-id="${escapeHTML(pet.id)}" title="Edit Pet">
                        <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button class="delete-pet-btn w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors" data-id="${escapeHTML(pet.id)}" title="Delete Pet">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>

                <div class="flex items-center space-x-5 mb-5">
                    <div class="w-20 h-20 bg-gray-50 border-2 border-gray-100 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                        ${imageHtml}
                    </div>
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 leading-tight">${escapeHTML(pet.name)}</h3>
                        <p class="text-sm font-medium text-[#16a34a] mt-0.5">${escapeHTML(pet.species)} ${pet.breed ? `<span class="text-gray-400 font-normal ml-1">· ${escapeHTML(pet.breed)}</span>` : ''}</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-y-3 gap-x-4 bg-gray-50/50 rounded-xl p-4 border border-gray-50">
                    <div>
                        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">อายุ</div>
                        <div class="text-sm text-gray-700 font-medium">${escapeHTML(ageDisplay) || '-'}</div>
                    </div>
                    <div>
                        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">น้ำหนัก</div>
                        <div class="text-sm text-gray-700 font-medium">${pet.weight ? escapeHTML(pet.weight) + ' กก.' : '-'}</div>
                    </div>
                </div>
                ${pet.notes ? `
                <div class="mt-3 pt-3 border-t border-dashed border-gray-100">
                    <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">หมายเหตุ</div>
                    <div class="text-sm text-gray-600 font-medium leading-relaxed">${escapeHTML(pet.notes)}</div>
                </div>
                ` : ''}
            `;
            petsGrid.appendChild(card);
        });

        // Add event listeners tracking
        document.querySelectorAll('.edit-pet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openModal(e.currentTarget.dataset.id));
        });
        document.querySelectorAll('.delete-pet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openDeleteModal(e.currentTarget.dataset.id));
        });
    }

    function calculateAge(birthDateStr) {
        if (!birthDateStr) return '';
        const birthDate = new Date(birthDateStr);
        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        
        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months += 12;
        }

        if (years > 0) {
            return `${years} ปี ${months > 0 ? months + ' เดือน' : ''}`;
        } else if (months > 0) {
            return `${months} เดือน`;
        } else {
            return `น้อยกว่า 1 เดือน`;
        }
    }

    // =============== Modal Operations ===============

    function openModal(petId = null) {
        // Reset form
        petForm.reset();
        currentTempImageSrc = "";
        petImagePreview.src = "";
        petImagePreview.classList.add('hidden');
        petImagePlaceholder.classList.remove('hidden');

        if (petId) {
            // Edit Mode
            const pet = pets.find(p => p.id === petId);
            if (pet) {
                modalTitle.textContent = "แก้ไขข้อมูลสัตว์เลี้ยง";
                petIdInput.value = pet.id;
                petNameInput.value = pet.name;
                petSpeciesInput.value = pet.species;
                if (pet.breed) petBreedInput.value = pet.breed;
                if (pet.birthDate) petBirthDateInput.value = pet.birthDate;
                if (pet.weight) petWeightInput.value = pet.weight;
                if (pet.notes) petNotesInput.value = pet.notes;
                
                if (pet.image) {
                    currentTempImageSrc = pet.image;
                    petImagePreview.src = pet.image;
                    petImagePreview.classList.remove('hidden');
                    petImagePlaceholder.classList.add('hidden');
                }
            }
        } else {
            // Add Mode
            modalTitle.textContent = "เพิ่มสัตว์เลี้ยงใหม่";
            petIdInput.value = "";
        }

        petFormModal.classList.remove('opacity-0', 'pointer-events-none');
        const innerDiv = petFormModal.querySelector('div');
        innerDiv.classList.remove('scale-95');
        innerDiv.classList.add('scale-100');
    }

    function closeModal() {
        petFormModal.classList.add('opacity-0', 'pointer-events-none');
        const innerDiv = petFormModal.querySelector('div');
        innerDiv.classList.remove('scale-100');
        innerDiv.classList.add('scale-95');
    }

    function openDeleteModal(petId) {
        petToDeleteId = petId;
        const pet = pets.find(p => p.id === petId);
        if (pet) {
            deletePetNameSpan.textContent = pet.name;
            deleteModal.classList.remove('opacity-0', 'pointer-events-none');
            const innerDiv = deleteModal.querySelector('div');
            innerDiv.classList.remove('scale-95');
            innerDiv.classList.add('scale-100');
        }
    }

    function closeDeleteModal() {
        petToDeleteId = null;
        deleteModal.classList.add('opacity-0', 'pointer-events-none');
        const innerDiv = deleteModal.querySelector('div');
        innerDiv.classList.remove('scale-100');
        innerDiv.classList.add('scale-95');
    }

    // =============== Event Listeners ===============

    addPetBtn.addEventListener('click', () => openModal());
    
    closeModalBtn.addEventListener('click', closeModal);
    cancelPetBtn.addEventListener('click', closeModal);

    // Image Upload Preview in Modal
    petImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showToast("กรุณาอัปโหลดไฟล์รูปภาพ", "error");
                return;
            }
            const reader = new FileReader();
            reader.onload = function(event) {
                currentTempImageSrc = event.target.result;
                petImagePreview.src = currentTempImageSrc;
                petImagePreview.classList.remove('hidden');
                petImagePlaceholder.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    // Save Pet Details
    savePetBtn.addEventListener('click', async () => {
        // Validation
        if (!petNameInput.value.trim()) {
            showToast("กรุณากรอกชื่อสัตว์เลี้ยง", "error");
            petNameInput.focus();
            return;
        }
        if (!petSpeciesInput.value) {
            showToast("กรุณาเลือกชนิดสัตว์เลี้ยง", "error");
            petSpeciesInput.focus();
            return;
        }

        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        let customerId = user?.customer_id;
        let csrfToken = user?.csrf_token;

        if (!customerId) {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const result = await res.json();
                    if (result.data) {
                        customerId = result.data.customer_id;
                        csrfToken = result.data.csrf_token;
                        localStorage.setItem('user', JSON.stringify(result.data));
                    }
                }
            } catch (err) {
                console.error("Error resolving session:", err);
            }
        }

        if (customerId) {
            savePetBtn.disabled = true;
            savePetBtn.textContent = "กำลังบันทึก...";
            
            const formData = new FormData();
            formData.append('customer_id', customerId);
            if (petIdInput.value) {
                formData.append('pet_id', petIdInput.value);
            }
            formData.append('pet_name', petNameInput.value.trim());
            formData.append('pet_type', petSpeciesInput.value);
            formData.append('breed', petBreedInput.value.trim());
            formData.append('birthdate', petBirthDateInput.value);
            formData.append('weight', petWeightInput.value);
            formData.append('notes', petNotesInput.value.trim());
            formData.append('csrf_token', csrfToken || '');

            if (petImageInput.files[0]) {
                formData.append('pet_image', petImageInput.files[0]);
            }

            try {
                const res = await fetch('/api/pets/save', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': csrfToken || ''
                    },
                    body: formData
                });

                if (res.ok) {
                    showToast(petIdInput.value ? "อัปเดตข้อมูลสัตว์เลี้ยงเรียบร้อยแล้ว" : "เพิ่มสัตว์เลี้ยงสำเร็จ", "success");
                    await loadPets();
                    closeModal();
                } else {
                    const errRes = await res.json();
                    console.error("Save pet failed details: " + JSON.stringify(errRes));
                    showToast(errRes.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
                }
            } catch (err) {
                console.error("Error saving pet to DB:", err);
                showToast("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อบันทึกข้อมูลได้", "error");
            } finally {
                savePetBtn.disabled = false;
                savePetBtn.textContent = "บันทึกข้อมูล";
            }
        } else {
            const petData = {
                id: petIdInput.value || Date.now().toString(),
                name: petNameInput.value.trim(),
                species: petSpeciesInput.value,
                breed: petBreedInput.value.trim(),
                birthDate: petBirthDateInput.value,
                weight: petWeightInput.value,
                notes: petNotesInput.value.trim(),
                image: currentTempImageSrc,
                createdAt: petIdInput.value ? pets.find(p => p.id === petIdInput.value).createdAt : new Date().toISOString()
            };

            if (petIdInput.value) {
                const index = pets.findIndex(p => p.id === petIdInput.value);
                if (index !== -1) {
                    pets[index] = petData;
                    showToast(`อัปเดตโปรไฟล์ของ ${petData.name} เรียบร้อยแล้ว`, "success");
                }
            } else {
                pets.unshift(petData);
                showToast(`เพิ่มสัตว์เลี้ยง ${petData.name} สำเร็จ`, "success");
            }

            savePetsToLocal();
            renderPets();
            closeModal();
        }
    });

    // Delete Operations
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    
    confirmDeleteBtn.addEventListener('click', async () => {
        if (!petToDeleteId) return;

        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        let customerId = user?.customer_id;
        let csrfToken = user?.csrf_token;

        if (!customerId) {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const result = await res.json();
                    if (result.data) {
                        customerId = result.data.customer_id;
                        csrfToken = result.data.csrf_token;
                        localStorage.setItem('user', JSON.stringify(result.data));
                    }
                }
            } catch (err) {
                console.error("Error resolving session:", err);
            }
        }

        if (customerId) {
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = "กำลังลบ...";

            try {
                const res = await fetch('/api/pets/delete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || ''
                    },
                    body: JSON.stringify({
                        pet_id: parseInt(petToDeleteId),
                        customer_id: customerId,
                        csrf_token: csrfToken
                    })
                });

                if (res.ok) {
                    showToast("ลบสัตว์เลี้ยงออกจากโปรไฟล์แล้ว", "success");
                    await loadPets();
                    closeDeleteModal();
                } else {
                    const errRes = await res.json();
                    showToast(errRes.message || "เกิดข้อผิดพลาดในการลบสัตว์เลี้ยง", "error");
                }
            } catch (err) {
                console.error("Error deleting pet from DB:", err);
                showToast("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อลบข้อมูลได้", "error");
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = "ยืนยันการลบ";
            }
        } else {
            pets = pets.filter(p => p.id !== petToDeleteId);
            savePetsToLocal();
            renderPets();
            showToast("ลบสัตว์เลี้ยงออกจากโปรไฟล์แล้ว", "success");
            closeDeleteModal();
        }
    });

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMyPetsPage);
} else {
    initMyPetsPage();
}
