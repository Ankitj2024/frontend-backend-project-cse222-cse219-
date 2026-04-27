// Apply theme immediately
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

const renderSidebar = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const isPage = (name) => {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            return hash === name || window.location.pathname.includes(name);
        }
        if (window.location.pathname.includes('admin') && name === 'overview') return true;
        return window.location.pathname.includes(name);
    };

    const getNavLinks = (role) => {
        if (role === 'admin') {
            return [
                { href: '/admin.html#overview', label: 'Overview', icon: 'pie-chart', id: 'overview' },
                { href: '/admin.html#users', label: 'Users', icon: 'users', id: 'users' },
                { href: '/admin.html#doctors', label: 'Doctors', icon: 'stethoscope', id: 'doctors' },
                { href: '/admin.html#analytics', label: 'Analytics', icon: 'bar-chart', id: 'analytics' },
                { href: '/profile.html', label: 'Profile', icon: 'user', id: 'profile' }
            ];
        }

        const links = [
            { href: '/dashboard.html', label: 'Dashboard', icon: 'layout-dashboard', id: 'dashboard' }
        ];

        if (role === 'doctor' || role === 'patient') {
            links.push({ href: '/medicines.html', label: 'Medication', icon: 'pill', id: 'medicines' });
        }

        if (role !== 'doctor') {
            links.push({ href: '/history.html', label: 'History', icon: 'activity', id: 'history' });
        }

        links.push({ href: '/profile.html', label: 'Profile', icon: 'user', id: 'profile' });

        return links;
    };

    const navLinks = getNavLinks(user.role);

    const sidebarHTML = `
        <div class="sidebar">
            <div class="mb-12 px-4">
                <a href="/dashboard.html" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <div class="w-10 h-10 bg-primary dark:bg-sky-600 dark:bg-sky-600 rounded-xl flex items-center justify-center text-white shadow-sm dark:shadow-none">
                        <i data-lucide="activity" class="w-6 h-6"></i>
                    </div>
                    <h1 class="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 dark:text-slate-100 tracking-tight">MedRemind</h1>
                </a>
            </div>

            <nav class="flex flex-col gap-2">
                ${navLinks.map(link => `
                    <a href="${link.href}" class="nav-link ${isPage(link.id) ? 'active' : ''}">
                        <i data-lucide="${link.icon}"></i>
                        <span>${link.label}</span>
                    </a>
                `).join('')}
            </nav>

            <div class="mt-auto px-4">
                
                <button id="global-logout" class="w-full flex items-center justify-center gap-3 py-4 text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 dark:text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-danger hover:bg-rose-50 rounded-2xl transition-all text-sm font-bold">
                    <i data-lucide="log-out" class="w-5 h-5"></i>
                    Logout
                </button>
            </div>
        </div>

        <nav class="mobile-nav">
            ${navLinks.map(link => `
                <a href="${link.href}" class="mobile-nav-link ${isPage(link.id) ? 'active' : ''}">
                    <i data-lucide="${link.icon}" class="w-6 h-6"></i>
                    <span>${link.label.split(' ')[0]}</span>
                </a>
            `).join('')}
        </nav>
    `;

    // Wrap content
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = '';

    const appContainer = document.createElement('div');
    appContainer.className = 'app-container';
    appContainer.innerHTML = sidebarHTML;

    const mainContent = document.createElement('main');
    mainContent.className = 'main-content';

    const greetingLabel = user.role === 'doctor'
        ? 'Clinical Control Center'
        : user.role === 'caregiver'
            ? 'Caregiver Hub'
            : user.role === 'admin'
                ? 'Administrator Hub'
                : 'Personal Health Dashboard';

    const showGreeting = isPage('dashboard');

    let rawName = user.name.trim();
    if (rawName.toLowerCase().startsWith('dr. ')) rawName = rawName.substring(4);
    else if (rawName.toLowerCase().startsWith('dr ')) rawName = rawName.substring(3);

    const firstName = rawName.split(' ')[0];
    const greetingName = user.role === 'doctor' ? `Dr. ${firstName}` : firstName;

    const standardHeader = `
        <header class="flex items-center ${showGreeting ? 'justify-between' : 'justify-end'} mb-6 animate-fade-in gap-4 flex-wrap">
            ${showGreeting ? `
            <div>
                <p class="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">${greetingLabel}</p>
                <h2 class="text-3xl font-display font-black text-slate-700 dark:text-slate-200">Hello, <span class="text-primary">${greetingName}</span></h2>
            </div>
            ` : ''}
            <div class="flex items-center gap-3 sm:gap-4 ml-auto">
                <!-- Gamified Counters Removed -->

                <button id="theme-toggle" class="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border-b-4 border-slate-200 dark:border-slate-600 active:border-b-0 active:translate-y-1">
                    <i data-lucide="moon" class="w-5 h-5 block dark:hidden"></i>
                    <i data-lucide="sun" class="w-5 h-5 hidden dark:block text-warning"></i>
                </button>
                <a href="/profile.html" class="flex items-center gap-4 hover:opacity-80 transition-opacity ml-2">
                    <div class="text-right hidden md:block">
                        <p class="text-sm font-black text-slate-700 dark:text-slate-200">${user.name}</p>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${user.role}</p>
                    </div>
                    <div class="w-12 h-12 rounded-full bg-white border-2 border-slate-200 border-b-4 shadow-sm overflow-hidden hover:scale-105 transition-all cursor-pointer">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}" class="w-full h-full object-cover">
                    </div>
                </a>
            </div>
        </header>
    `;

    mainContent.innerHTML = standardHeader + `<div class="content-body">${originalContent}</div>`;
    appContainer.appendChild(mainContent);
    document.body.appendChild(appContainer);

    // Re-initialize icons
    if (window.lucide) lucide.createIcons();

    // Global Logout handler
    document.getElementById('global-logout')?.addEventListener('click', () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });

    // Theme Toggle Handler
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
    });
};

// Auto-render if not on index or register
if (!window.location.pathname.includes('index') && !window.location.pathname.includes('register') && window.location.pathname !== '/') {
    document.addEventListener('DOMContentLoaded', renderSidebar);
}
