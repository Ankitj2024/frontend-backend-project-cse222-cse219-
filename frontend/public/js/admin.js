let usersData = [];
let chartInstance = null;

const initAdmin = async () => {
    document.getElementById('doctor-form')?.addEventListener('submit', handleAddDoctor);
    await loadData();
    // Default open based on hash or overview
    const hash = window.location.hash.replace('#', '') || 'overview';
    switchAdminTab(hash);

    window.addEventListener('hashchange', () => {
        const newHash = window.location.hash.replace('#', '') || 'overview';
        switchAdminTab(newHash);
    });
};

const loadData = async () => {
    try {
        const users = await apiFetch('/admin/users');
        usersData = users;
        renderOverview();
        renderUsersTable();
        renderDoctorsGrid();
        renderChart();
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Failed to load admin data:', err);
    }
};

window.switchAdminTab = (tabId) => {
    // Update active tab button classes
    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.classList.remove('active', 'bg-slate-100', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white');
        btn.classList.add('text-slate-500');
    });
    const activeBtn = document.getElementById(`tab-btn-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-slate-500');
        activeBtn.classList.add('active', 'bg-slate-100', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-white');
    }

    // Show selected section
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`section-${tabId}`)?.classList.remove('hidden');

    // Update sidebar links
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(tabId) || (tabId === 'overview' && link.getAttribute('href') === '/admin.html#overview')) {
            link.classList.add('active');
        }
    });

    window.location.hash = tabId;
    if (window.lucide) lucide.createIcons();
};

const renderOverview = () => {
    const total = usersData.length;
    const patients = usersData.filter(u => u.role === 'patient').length;
    const doctors = usersData.filter(u => u.role === 'doctor').length;
    const caregivers = usersData.filter(u => u.role === 'caregiver').length;

    document.getElementById('stat-total-users').textContent = total;
    document.getElementById('stat-patients').textContent = patients;
    document.getElementById('stat-doctors').textContent = doctors;
    document.getElementById('stat-caregivers').textContent = caregivers;
};

const renderUsersTable = () => {
    const tbody = document.getElementById('user-list-body');
    if (!tbody) return;

    tbody.innerHTML = usersData.map(u => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}" class="w-8 h-8 rounded-full bg-slate-100">
                    <span class="font-bold text-slate-800 dark:text-slate-200">${u.name}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm font-medium">${u.email}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    ${u.role}
                </span>
                ${u.role === 'doctor' && !u.isApproved ? `
                    <span class="ml-2 px-2 py-1 text-[9px] font-black uppercase tracking-tighter rounded bg-amber-100 text-amber-600">Pending</span>
                ` : ''}
            </td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    ${u.role === 'doctor' && !u.isApproved ? `
                        <button onclick="approveDoctor('${u._id}')" class="p-2 text-primary hover:bg-emerald-50 rounded-lg transition-colors" title="Approve Doctor">
                            <i data-lucide="user-check" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                    ${u.role !== 'admin' ? `
                        <button onclick="window.deleteUser('${u._id}')" class="p-2 text-danger hover:bg-rose-50 rounded-lg transition-colors" title="Delete User">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
};

const renderDoctorsGrid = () => {
    const grid = document.getElementById('doctor-list');
    if (!grid) return;

    const doctors = usersData.filter(u => u.role === 'doctor');

    if (doctors.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400">No doctors found.</div>`;
        return;
    }

    grid.innerHTML = doctors.map(doc => `
        <div class="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl transition-all group relative">
            <div class="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button onclick="window.deleteUser('${doc._id}')" class="p-2 bg-danger text-white rounded-xl shadow-md hover:scale-110 active:scale-95 transition-all">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="flex items-center gap-4 mb-6">
                <div class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center border-2 border-white dark:border-slate-600 shadow-sm">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${doc.name}" class="w-12 h-12">
                </div>
                <div>
                    <h3 class="font-display font-black text-lg text-slate-800 dark:text-white">${doc.name}</h3>
                    <p class="text-xs font-bold text-primary uppercase tracking-widest">Medical Doctor</p>
                </div>
            </div>
            <div class="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-6">
                <i data-lucide="mail" class="w-4 h-4"></i>
                <span class="text-sm font-medium">${doc.email}</span>
            </div>
            ${!doc.isApproved ? `
                <button onclick="approveDoctor('${doc._id}')" class="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    <i data-lucide="user-check" class="w-4 h-4"></i> Approve Doctor
                </button>
            ` : `
                <div class="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest">
                    <i data-lucide="check-circle" class="w-4 h-4"></i> Approved
                </div>
            `}
        </div>
    `).join('');
};

const renderChart = () => {
    const ctx = document.getElementById('userRoleChart');
    if (!ctx) return;

    const patients = usersData.filter(u => u.role === 'patient').length;
    const doctors = usersData.filter(u => u.role === 'doctor').length;
    const caregivers = usersData.filter(u => u.role === 'caregiver').length;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Patients', 'Doctors', 'Caregivers'],
            datasets: [{
                data: [patients, doctors, caregivers],
                backgroundColor: ['#1cb0f6', '#58cc02', '#ffc800'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: isDark ? '#cbd5e1' : '#475569',
                        font: { family: "'Nunito', sans-serif", weight: 'bold' }
                    }
                }
            },
            cutout: '70%'
        }
    });
};

window.deleteUser = async (id) => {
    console.log('[Admin] Requesting deletion of user:', id);
    if (confirm('Permanently remove this user from the system?')) {
        try {
            await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
            console.log('[Admin] User deleted successfully:', id);
            await loadData();
        } catch (err) {
            console.error('[Admin] Delete failed:', err);
            alert('Failed to delete user: ' + err.message);
        }
    }
};

window.approveDoctor = async (id) => {
    try {
        await apiFetch(`/admin/doctors/${id}/approve`, { method: 'PUT' });
        await loadData();
    } catch (err) {
        alert('Failed to approve doctor: ' + err.message);
    }
};

window.openDoctorModal = () => {
    document.getElementById('doctor-modal').classList.remove('hidden');
    document.getElementById('doctor-form').reset();
};

window.closeDoctorModal = () => {
    document.getElementById('doctor-modal').classList.add('hidden');
};

const handleAddDoctor = async (e) => {
    e.preventDefault();
    const name = document.getElementById('doc-name').value;
    const email = document.getElementById('doc-email').value;
    const password = document.getElementById('doc-password').value;

    try {
        await apiFetch('/admin/doctors', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        closeDoctorModal();
        await loadData();
    } catch (err) {
        alert(err.message);
    }
};

document.addEventListener('DOMContentLoaded', initAdmin);
