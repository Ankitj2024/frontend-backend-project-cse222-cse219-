// ─── State ───────────────────────────────────────────────────────────────────
let currentFilter = 'active';
let editingId = null;
let medicineList = null;
let addMedForm = null;

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) { window.location.href = 'index.html'; return; }

    // Query DOM elements AFTER DOM is ready
    medicineList = document.getElementById('medicine-list');
    addMedForm = document.getElementById('add-med-form');

    if (user.role === 'doctor') {
        await initDoctorMode();
    }

    // Wire form submit
    addMedForm?.addEventListener('submit', handleFormSubmit);

    loadMedicines();
});

// ─── Doctor: load patient dropdown ──────────────────────────────────────────
async function initDoctorMode() {
    const container = document.getElementById('patient-select-container');
    const select = document.getElementById('assign-patient');
    if (!container || !select) return;

    container.classList.remove('hidden');
    document.getElementById('notes-container')?.classList.remove('hidden');
    try {
        const patients = await apiFetch('/users/patients');
        patients.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p._id;
            opt.textContent = `${p.name} (${p.email})`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to load patients:', err.message);
    }

    // Hide medicine list and expand form for doctors
    document.getElementById('list-wrapper')?.classList.add('hidden');
    const formWrapper = document.getElementById('form-wrapper');
    if (formWrapper) {
        formWrapper.classList.remove('lg:col-span-5');
        formWrapper.classList.add('lg:col-span-12');
    }
}

// ─── Filter UI ───────────────────────────────────────────────────────────────
window.setFilter = function (filter) {
    currentFilter = filter;

    // Update tab styles
    ['active', 'onhold', 'completed', 'all'].forEach(id => {
        const btn = document.getElementById(`filter-${id}`);
        if (!btn) return;
        btn.className = 'px-5 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-400 dark:text-slate-500 border border-transparent dark:border-slate-700 hover:border-primary/30 transition-all';
    });

    const activeMap = { 'active': 'filter-active', 'on hold': 'filter-onhold', 'completed': 'filter-completed', 'all': 'filter-all' };
    const activeBtn = document.getElementById(activeMap[filter]);
    if (activeBtn) activeBtn.className = 'px-5 py-2.5 rounded-xl text-sm font-bold bg-primary dark:bg-sky-600 text-white transition-all';

    loadMedicines();
};

// ─── Toggle day-of-week picker based on frequency ─────────────────────────────
window.toggleDayPicker = function () {
    const freq = document.getElementById('med-frequency')?.value;
    const picker = document.getElementById('day-picker-container');
    if (!picker) return;
    if (freq === 'Weekly') {
        picker.classList.remove('hidden');
    } else {
        picker.classList.add('hidden');
        // Uncheck all days when hidden
        picker.querySelectorAll('input[name="day-of-week"]').forEach(cb => cb.checked = false);
    }
};

// ─── READ: Load medicine list ─────────────────────────────────────────────────
async function loadMedicines() {
    if (!medicineList) return;

    medicineList.innerHTML = `
        <div class="flex items-center justify-center py-20">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>`;

    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const medicines = await apiFetch('/medicines');

        const filtered = currentFilter === 'all'
            ? medicines
            : medicines.filter(m => (m.status || 'active') === currentFilter);

        if (filtered.length === 0) {
            medicineList.innerHTML = `
                <div class="card-white flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                    <i data-lucide="package-open" class="w-16 h-16 mb-4 opacity-10"></i>
                    <p class="text-lg font-display font-bold">No ${currentFilter === 'all' ? '' : currentFilter} medications</p>
                    <p class="text-sm mt-1">Use the form to add a new prescription.</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        medicineList.innerHTML = filtered.map(med => {
            const statusMap = {
                'active': { cls: 'bg-emerald-100 text-emerald-700', label: 'Active' },
                'on hold': { cls: 'bg-amber-100 text-amber-700', label: 'On Hold' },
                'completed': { cls: 'bg-slate-100 text-slate-500 dark:text-slate-400 dark:text-slate-500', label: 'Completed' },
            };
            const s = statusMap[med.status || 'active'] || statusMap['active'];

            // Convert stored "08:30 AM" to 24h for display of native time input (for edit pre-fill)
            return `
                <div class="card-white group hover:border-primary/20 transition-all duration-200">
                    <div class="flex items-start justify-between gap-4">
                        <!-- Info -->
                        <div class="flex items-start gap-4 flex-1 min-w-0">
                            <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary dark:bg-sky-600/10 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <i data-lucide="pill" class="w-6 h-6"></i>
                            </div>
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 flex-wrap mb-1">
                                    <h4 class="text-lg font-display font-bold text-slate-800 dark:text-slate-100">${escapeHtml(med.name)}</h4>
                                    <span class="px-2 py-0.5 ${s.cls} text-[10px] font-bold uppercase rounded-md">${s.label}</span>
                                </div>
                                <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                                    <span class="flex items-center gap-1">
                                        <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                                        ${escapeHtml(med.time)}
                                    </span>
                                    ${med.dosage ? `<span class="flex items-center gap-1">
                                        <i data-lucide="activity" class="w-3.5 h-3.5 text-slate-400"></i>
                                        ${escapeHtml(med.dosage)}
                                    </span>` : ''}
                                    <span class="flex items-center gap-1">
                                        <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                                        ${escapeHtml(med.frequency || 'Daily')}
                                    </span>
                                </div>
                                ${med.notes ? `
                                <div class="mt-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-start gap-2">
                                    <span class="text-base shrink-0 leading-none mt-0.5">📝</span>
                                    <p class="text-sm font-medium text-amber-800"><span class="font-bold">Doctor:</span> ${escapeHtml(med.notes)}</p>
                                </div>` : ''}
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 shrink-0">
                            ${(user.role === 'doctor' || user.role === 'caregiver' || (user.role === 'patient' && med.prescribedByRole === 'patient')) ? `
                                <button onclick="editMedicine('${med._id}')"
                                    class="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-primary dark:hover:bg-sky-500 hover:text-white dark:hover:text-white transition-all"
                                    title="Edit">
                                    <i data-lucide="pencil" class="w-4 h-4"></i>
                                </button>
                                <button onclick="toggleStatus('${med._id}', '${med.status || 'active'}')"
                                    class="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:text-amber-500 dark:hover:text-amber-400 transition-all"
                                    title="${med.status === 'active' ? 'Pause' : 'Activate'}">
                                    <i data-lucide="${med.status === 'active' ? 'pause' : 'play'}" class="w-4 h-4"></i>
                                </button>
                                <button onclick="deleteMedicine('${med._id}')"
                                    class="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 text-rose-400 flex items-center justify-center hover:bg-rose-500 dark:hover:bg-rose-600 hover:text-white dark:hover:text-white transition-all"
                                    title="Delete">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            ` : `
                                <span class="px-3 py-1.5 bg-slate-100 text-slate-400 text-[10px] font-bold uppercase rounded-lg border border-slate-200 cursor-help" title="Only the person who scheduled this can modify it">
                                    Locked
                                </span>
                            `}
                        </div>
                    </div>
                </div>`;
        }).join('');

        lucide.createIcons();
    } catch (err) {
        medicineList.innerHTML = `
            <div class="card-white py-12 text-center text-rose-500 font-bold">
                <i data-lucide="wifi-off" class="w-10 h-10 mx-auto mb-3 opacity-40"></i>
                <p>Failed to load medicines.</p>
                <button onclick="loadMedicines()" class="mt-4 px-6 py-2 bg-primary dark:bg-sky-600 text-white rounded-xl text-sm font-bold">Retry</button>
            </div>`;
        lucide.createIcons();
    }
}

// ─── Helper: XSS safe ────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Helper: convert 12h → 24h for <input type="time"> ──────────────────────
function to24h(timeStr) {
    if (!timeStr) return '';
    const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return '';
    let h = parseInt(m[1]);
    const min = m[2];
    const period = m[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return `${String(h).padStart(2, '0')}:${min}`;
}

// ─── Helper: convert 24h → 12h AM/PM ─────────────────────────────────────────
function to12h(rawTime) {
    if (!rawTime) return '';
    const [hStr, mStr] = rawTime.split(':');
    const h24 = parseInt(hStr, 10);
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${String(h12).padStart(2, '0')}:${mStr} ${period}`;
}

// ─── UPDATE (enter edit mode): prefill form ───────────────────────────────────
window.editMedicine = async function (id) {
    try {
        const med = await apiFetch(`/medicines/${id}`);
        editingId = id;

        document.getElementById('edit-med-id').value = id;
        document.getElementById('med-name').value = med.name;
        document.getElementById('med-dosage').value = med.dosage || '';
        document.getElementById('med-time').value = to24h(med.time);
        document.getElementById('med-frequency').value = med.frequency || 'Daily';
        if (document.getElementById('med-notes')) document.getElementById('med-notes').value = med.notes || '';

        // Show/hide day picker and restore checked days
        toggleDayPicker();
        if (med.frequency === 'Weekly' && Array.isArray(med.daysOfWeek)) {
            document.querySelectorAll('input[name="day-of-week"]').forEach(cb => {
                cb.checked = med.daysOfWeek.includes(parseInt(cb.value));
            });
        }

        // Show status field in edit mode
        const statusContainer = document.getElementById('status-container');
        statusContainer.classList.remove('hidden');
        document.getElementById('med-status').value = med.status || 'active';

        // Update form UI to edit mode
        document.getElementById('form-title').textContent = 'Edit Medication';
        document.getElementById('form-icon').className = 'w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-500';
        document.getElementById('form-icon').innerHTML = '<i data-lucide="pencil" class="w-7 h-7"></i>';
        lucide.createIcons();

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.innerHTML = '<i data-lucide="save" class="w-5 h-5"></i> Save Changes';
        submitBtn.className = 'flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl shadow-lg dark:shadow-none hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2';
        lucide.createIcons();

        document.getElementById('cancel-edit-btn').classList.remove('hidden');

        // Scroll form into view
        document.getElementById('add-med-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        alert('Failed to load medicine details: ' + err.message);
    }
};

// ─── Cancel edit → back to create mode ───────────────────────────────────────
window.cancelEdit = function () {
    editingId = null;
    addMedForm.reset();
    document.getElementById('edit-med-id').value = '';
    document.getElementById('status-container').classList.add('hidden');
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    // Hide and reset day picker
    const picker = document.getElementById('day-picker-container');
    if (picker) {
        picker.classList.add('hidden');
        picker.querySelectorAll('input[name="day-of-week"]').forEach(cb => cb.checked = false);
    }
    if (document.getElementById('med-notes')) document.getElementById('med-notes').value = '';
    if (document.getElementById('med-diagnosis')) document.getElementById('med-diagnosis').value = '';

    document.getElementById('form-title').textContent = 'Add Medication';
    document.getElementById('form-icon').className = 'w-14 h-14 rounded-2xl bg-primary dark:bg-sky-600/10 flex items-center justify-center text-primary';
    document.getElementById('form-icon').innerHTML = '<i data-lucide="plus" class="w-7 h-7"></i>';

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.innerHTML = '<i data-lucide="plus" class="w-5 h-5"></i> Add Medication';
    submitBtn.className = 'flex-1 py-4 bg-primary dark:bg-sky-600 text-white font-bold rounded-2xl shadow-sm hover:shadow-md transition-all border border-primary dark:shadow-none dark:border-sky-600 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2';
    lucide.createIcons();
};

// ─── CREATE + UPDATE: form submit ─────────────────────────────────────────────
async function handleFormSubmit(e) {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('user'));

    const name = document.getElementById('med-name').value.trim();
    const rawTime = document.getElementById('med-time').value;
    const dosage = document.getElementById('med-dosage').value.trim();
    const patientId = document.getElementById('assign-patient')?.value;
    const frequency = document.getElementById('med-frequency')?.value || 'Daily';
    const status = document.getElementById('med-status')?.value || 'active';
    const notes = document.getElementById('med-notes')?.value.trim();
    const diagnosis = document.getElementById('med-diagnosis')?.value.trim();

    // Collect selected days of week (for Weekly)
    const daysOfWeek = Array.from(
        document.querySelectorAll('input[name="day-of-week"]:checked')
    ).map(cb => parseInt(cb.value));

    if (!name || !rawTime) {
        showFormError('Please fill in Medication Name and Time.');
        return;
    }
    if (frequency === 'Weekly' && daysOfWeek.length === 0) {
        showFormError('Please select at least one day for Weekly frequency.');
        return;
    }
    if (user.role === 'doctor' && !editingId && !patientId) {
        showFormError('Please select a patient to assign this medication.');
        return;
    }

    const time = to12h(rawTime);
    const submitBtn = document.getElementById('submit-btn');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg> Saving...';

    try {
        if (editingId) {
            // ── UPDATE ──
            const payload = { name, time, dosage, frequency, daysOfWeek, status };
            if (user.role === 'doctor') payload.notes = notes;

            await apiFetch(`/medicines/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showFormSuccess('Medication updated successfully!');
            cancelEdit();
        } else {
            // ── CREATE ──
            const data = { name, time, dosage, frequency, daysOfWeek, startDate: new Date().toISOString() };
            if (user.role === 'doctor') {
                if (patientId) data.user = patientId;
                if (notes) data.notes = notes;
                if (diagnosis) data.diagnosis = diagnosis;
            }
            await apiFetch('/medicines', { method: 'POST', body: JSON.stringify(data) });
            addMedForm.reset();
            // Reset day picker after form reset
            toggleDayPicker();
            showFormSuccess('Medication scheduled successfully!');
        }
        loadMedicines();
    } catch (err) {
        showFormError(err.message || 'Failed to save medication.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
        lucide.createIcons();
    }
}

// ─── Form feedback helpers ─────────────────────────────────────────────────────
function showFormSuccess(msg) {
    showToast(msg, 'emerald');
}
function showFormError(msg) {
    showToast(msg, 'rose');
}
function showToast(msg, color) {
    document.getElementById('med-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'med-toast';
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-${color}-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm transition-all`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ─── TOGGLE STATUS (Pause / Activate) ────────────────────────────────────────
window.toggleStatus = async function (id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'on hold' : 'active';
    try {
        await apiFetch(`/medicines/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        loadMedicines();
    } catch (err) {
        alert('Failed to update status: ' + err.message);
    }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
window.deleteMedicine = async function (id) {
    // Show inline confirmation instead of window.confirm (blocked in some environments)
    const existingConfirm = document.getElementById(`confirm-${id}`);
    if (existingConfirm) {
        // Already showing confirm — perform the deletion
        existingConfirm.remove();
        try {
            await apiFetch(`/medicines/${id}`, { method: 'DELETE' });
            showFormSuccess('Medication removed.');
            if (editingId === id) cancelEdit();
            loadMedicines();
        } catch (err) {
            showFormError('Failed to delete: ' + (err.message || 'Server error'));
        }
        return;
    }

    // Show a small inline confirm banner under the card
    const card = document.querySelector(`button[onclick="deleteMedicine('${id}')"]`)?.closest('.card-white');
    if (!card) return;

    const confirmBar = document.createElement('div');
    confirmBar.id = `confirm-${id}`;
    confirmBar.className = 'mt-3 flex items-center justify-between gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100';
    confirmBar.innerHTML = `
        <span class="text-sm text-rose-700 font-semibold">Delete this medication?</span>
        <div class="flex gap-2">
            <button onclick="deleteMedicine('${id}')" class="px-4 py-1.5 bg-rose-500 text-white text-sm font-bold rounded-lg hover:bg-rose-600 transition-all">Yes, Delete</button>
            <button onclick="document.getElementById('confirm-${id}').remove()" class="px-4 py-1.5 bg-white text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm font-bold rounded-lg border border-transparent dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900/50 transition-all">Cancel</button>
        </div>`;
    card.appendChild(confirmBar);
};
