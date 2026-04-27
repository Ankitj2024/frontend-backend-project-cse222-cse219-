document.addEventListener('DOMContentLoaded', loadHistory);

let selectedCalendarDate = null;

async function loadHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    const historyList = document.getElementById('history-list');

    // Task 14: Loading State
    historyList.innerHTML = `
        <tr>
            <td colspan="4" class="px-8 py-20 text-center text-slate-400 dark:text-slate-500">
                <div class="flex flex-col items-center gap-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p class="font-medium">Syncing history logs...</p>
                </div>
            </td>
        </tr>
    `;

    try {
        let logs = [];
        if (user.role === 'caregiver') {
            const patients = await apiFetch('/users/my-patients');
            const logPromises = patients.map(p => apiFetch(`/logs/patient/${p._id}`));
            const allPatientLogs = await Promise.all(logPromises);
            logs = allPatientLogs.flat();
        } else {
            logs = await apiFetch('/logs');
        }

        // Render Calendar & Streak BEFORE filtering logs
        renderCalendarAndStreak(logs);

        // Apply Filters (Task 13)
        const nameFilter = document.getElementById('filter-name')?.value.toLowerCase();
        const statusFilter = document.getElementById('filter-status')?.value;
        const dateFilter = document.getElementById('filter-date')?.value;

        let filtered = logs;

        if (nameFilter) {
            filtered = filtered.filter(l => l.medicine?.name.toLowerCase().includes(nameFilter));
        }

        if (statusFilter && statusFilter !== 'all') {
            filtered = filtered.filter(l => l.status === statusFilter);
        }

        if (selectedCalendarDate) {
            // Feature 2: Filter by specific calendar date
            filtered = filtered.filter(l => {
                const logDate = new Date(l.date);
                const localDateStr = new Date(logDate.getTime() - (logDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                return localDateStr === selectedCalendarDate;
            });
            // Clear the dropdown date filter visually
            const df = document.getElementById('filter-date');
            if (df) df.value = 'all';
        } else if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter(l => {
                const logDate = new Date(l.date);
                if (dateFilter === 'today') return logDate.toDateString() === now.toDateString();
                if (dateFilter === 'week') {
                    const weekAgo = new Date();
                    weekAgo.setDate(now.getDate() - 7);
                    return logDate >= weekAgo;
                }
                if (dateFilter === 'month') {
                    const monthAgo = new Date();
                    monthAgo.setMonth(now.getMonth() - 1);
                    return logDate >= monthAgo;
                }
                return true;
            });
        }

        historyList.innerHTML = '';

        // Task 15: Empty State
        if (filtered.length === 0) {
            historyList.innerHTML = `
                <tr>
                    <td colspan="4" class="px-8 py-20 text-center text-slate-400 dark:text-slate-500">
                        <div class="flex flex-col items-center gap-4">
                            <i data-lucide="database-zap" class="w-12 h-12 opacity-10"></i>
                            <p class="font-medium italic">No history available for the selected filters</p>
                        </div>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        const isClinical = user.role === 'doctor' || user.role === 'caregiver';

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(log => {
            const dateObj = new Date(log.date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const isTaken = log.status === 'taken';
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group';

            row.innerHTML = `
                <td class="px-8 py-6">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-slate-800 dark:text-slate-100">${dateStr}</span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">${timeStr}</span>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-xl ${isTaken ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'} flex items-center justify-center shrink-0">
                            <i data-lucide="${isTaken ? 'check' : 'alert-circle'}" class="w-5 h-5"></i>
                        </div>
                        <span class="font-bold text-slate-700 dark:text-slate-200">${log.medicine ? log.medicine.name : 'System Log'}</span>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <span class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${isTaken ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                        ${log.status === 'taken' ? 'Taken' : 'Missed'}
                    </span>
                </td>
                <td class="px-8 py-6 text-right">
                    ${isClinical ? `
                        <div class="flex items-center justify-end gap-2">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${log.user?.name || 'User'}" class="w-6 h-6 rounded-full bg-slate-100">
                            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">${log.user?.name || 'Unknown'}</span>
                        </div>
                    ` : `
                        <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Self Action</span>
                    `}
                </td>
            `;
            historyList.appendChild(row);
        });
        lucide.createIcons();
    } catch (err) {
        historyList.innerHTML = `
            <tr>
                <td colspan="4" class="px-8 py-20 text-center text-rose-500 font-bold">
                    Unable to load logs at this time. Please check your connection.
                </td>
            </tr>
        `;
    }
}

function renderCalendarAndStreak(allLogs) {
    // 1. Group logs by local YYYY-MM-DD
    const logsByDay = {};
    allLogs.forEach(l => {
        const d = new Date(l.date);
        const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        if (!logsByDay[dateStr]) logsByDay[dateStr] = [];
        logsByDay[dateStr].push(l);
    });

    // 2. Generate last 30 days
    const days = [];
    const today = new Date();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let isCurrentStreakActive = true;

    // Go backwards from today to 365 days ago for streak calculation, but only show 30 days in calendar
    const CALENDAR_DAYS = 30;
    const STREAK_DAYS = 365;

    for (let i = 0; i < STREAK_DAYS; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        const dayLogs = logsByDay[dateStr] || [];

        let status = 'gray'; // no data
        if (dayLogs.length > 0) {
            const hasSkipped = dayLogs.some(l => l.status === 'skipped');
            if (hasSkipped) {
                status = 'red';
            } else {
                const hasTaken = dayLogs.some(l => l.status === 'taken');
                if (hasTaken) status = 'green';
            }
        }

        // Streak logic
        // "A day counts only if: ALL scheduled medicines were taken" -> represented by 'green'
        if (status === 'green') {
            tempStreak++;
            if (isCurrentStreakActive) currentStreak++;
        } else if (status === 'red' || status === 'gray') {
            // Do not break the current streak if today has no data yet
            if (i === 0 && status === 'gray') {
                // Ignore today if no data yet, keep streak active from yesterday
            } else {
                isCurrentStreakActive = false;
                if (tempStreak > longestStreak) longestStreak = tempStreak;
                tempStreak = 0;
            }
        }

        if (i < CALENDAR_DAYS) {
            days.push({
                dateObj: d,
                dateStr: dateStr,
                status: status,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNum: d.getDate()
            });
        }
    }

    // Final check for longest streak
    if (tempStreak > longestStreak) longestStreak = tempStreak;

    // Update Streak UI
    const currentEl = document.getElementById('current-streak');
    const longestEl = document.getElementById('longest-streak');
    const lastMissedEl = document.getElementById('last-missed-date');

    const sortedLogs = [...allLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastMissedLog = sortedLogs.find(l => l.status === 'skipped');
    const lastMissedStr = lastMissedLog ? new Date(lastMissedLog.date).toLocaleDateString() : 'Never';

    if (currentEl) currentEl.innerHTML = `${currentStreak} <span class="text-xl font-medium text-orange-300">days</span>`;
    if (longestEl) longestEl.textContent = `${longestStreak} days`;
    if (lastMissedEl) lastMissedEl.textContent = lastMissedStr;

    // Render Calendar UI
    const gridEl = document.getElementById('calendar-grid');
    if (gridEl) {
        // Reverse so chronological left to right
        gridEl.innerHTML = days.reverse().map(d => {
            let bgClass = 'bg-slate-50 dark:bg-slate-900/50 border-transparent dark:border-slate-700 text-slate-400 dark:text-slate-500';
            let iconClass = 'opacity-0';
            if (d.status === 'green') {
                bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-600';
                iconClass = 'text-emerald-500 opacity-100';
            } else if (d.status === 'red') {
                bgClass = 'bg-rose-50 border-rose-200 text-rose-600';
                iconClass = 'text-rose-500 opacity-100';
            }

            let tooltipText = 'No Data';
            if (d.status === 'green') tooltipText = 'Perfect Adherence';
            else if (d.status === 'red') tooltipText = 'Missed Dose(s)';

            const isSelected = selectedCalendarDate === d.dateStr;
            const ringClass = isSelected ? 'ring-2 ring-primary ring-offset-2 scale-105' : '';

            return `
                <button onclick="filterByCalendarDate('${d.dateStr}')" 
                        title="${tooltipText}"
                        class="flex flex-col items-center justify-center min-w-[4rem] h-[5rem] rounded-xl border ${bgClass} ${ringClass} hover:scale-105 transition-all snap-end shrink-0 relative overflow-hidden group">
                    <span class="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">${d.dayName}</span>
                    <span class="text-xl font-display font-bold">${d.dayNum}</span>
                    <i data-lucide="${d.status === 'green' ? 'check-circle' : 'x-circle'}" class="absolute bottom-1 right-1 w-3 h-3 ${iconClass}"></i>
                </button>
            `;
        }).join('');

        lucide.createIcons();

        // Scroll to end (right) to show most recent dates
        setTimeout(() => {
            gridEl.scrollLeft = gridEl.scrollWidth;
        }, 50);
    }
}

// Global click handler to apply calendar filter
window.filterByCalendarDate = (dateStr) => {
    if (selectedCalendarDate === dateStr) {
        selectedCalendarDate = null; // toggle off
    } else {
        selectedCalendarDate = dateStr;
    }
    loadHistory();
};

window.applyManualFilters = () => {
    selectedCalendarDate = null; // Clear calendar selection
    loadHistory();
};

// Task 16: Export Functionality
async function exportHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    try {
        const logs = await apiFetch('/logs');
        if (logs.length === 0) {
            alert('No data to export.');
            return;
        }

        const csvContent = "data:text/csv;charset=utf-8,"
            + "Date,Time,Medicine,Status,Method\n"
            + logs.map(l => {
                const d = new Date(l.date);
                return `${d.toLocaleDateString()},${d.toLocaleTimeString()},${l.medicine?.name || 'System'},${l.status},${user.role}`;
            }).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `MedRemind_History_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        alert('Failed to export data.');
    }
}
