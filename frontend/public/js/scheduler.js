/**
 * MedRemind – Real-Time Medication Scheduler
 * Runs only on the patient dashboard.
 * Shows a modal alert with "Taken" and "Snooze" (10 min) options.
 */

(function initScheduler() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'patient') return;

    // Track which medicines have already fired a notification this minute
    const notifiedThisMinute = new Set();
    let lastCheckedMinute = -1;

    // Track active snooze timers: medId -> timeoutId
    const snoozeTimers = {};

    // Track med count for sync
    let lastMedCount = -1;

    /**
     * Convert "08:30 AM" / "02:30 PM" to { hours, minutes }
     */
    function parseTime12h(timeStr) {
        if (!timeStr) return null;
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return null;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        if (period === 'AM' && h === 12) h = 0;
        if (period === 'PM' && h !== 12) h += 12;
        return { hours: h, minutes: m };
    }

    /**
     * Returns true if the medicine is scheduled for today based on its frequency.
     */
    function isMedicineDueToday(med) {
        const freq = (med.frequency || 'Daily').toLowerCase();
        const todayDay = new Date().getDay(); // 0=Sun, 6=Sat

        if (freq === 'weekly') {
            const days = Array.isArray(med.daysOfWeek) ? med.daysOfWeek : [];
            return days.includes(todayDay);
        }

        if (freq === 'every other day') {
            const start = new Date(med.startDate || med.date || Date.now());
            const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            const diffDays = Math.round((todayMidnight - startMidnight) / (1000 * 60 * 60 * 24));
            return diffDays % 2 === 0;
        }

        // Daily, Twice Daily, As Needed — always
        return true;
    }

    /**
     * Mark medicine as taken via API and refresh the dashboard view
     */
    async function markTaken(medId) {
        try {
            await apiFetch('/logs', {
                method: 'POST',
                body: JSON.stringify({ medicineId: medId, status: 'taken' })
            });
        } catch (e) {
            console.warn('[Scheduler] Could not log taken status:', e.message);
        }
        if (window.renderPatientView) window.renderPatientView();
    }

    /**
     * Show the in-page modal alert for a due medicine
     */
    function showMedAlert(med, isSnooze = false) {
        // Remove any existing alert for this medicine
        document.getElementById(`med-alert-${med._id}`)?.remove();

        const overlay = document.createElement('div');
        overlay.id = `med-alert-${med._id}`;
        overlay.className = 'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-0';
        overlay.style.background = 'rgba(15,23,42,0.55)';
        overlay.style.backdropFilter = 'blur(4px)';

        overlay.innerHTML = `
            <div
                id="med-alert-card-${med._id}"
                class="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl dark:shadow-none overflow-hidden"
                style="animation: slideUpAlert 0.35s cubic-bezier(.16,1,.3,1)"
            >
                <!-- Accent bar -->
                <div class="h-1.5 w-full bg-gradient-to-r from-sky-400 to-blue-600"></div>

                <div class="p-8">
                    <!-- Icon + title -->
                    <div class="flex items-center gap-5 mb-6">
                        <div class="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-9 h-9 text-sky-500" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
                                    00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                                    .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                            </svg>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mb-0.5">
                                ${isSnooze ? 'Snooze Over – Medicine Due' : 'Time to Take Your Medicine'}
                            </p>
                            <h3 class="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">${med.name}</h3>
                        </div>
                    </div>

                    <!-- Details -->
                    <div class="flex gap-3 mb-8">
                        <span class="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-transparent dark:border-slate-700">
                            🕐 ${med.time}
                        </span>
                        <span class="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-transparent dark:border-slate-700">
                            💊 ${med.dosage || '1 Tablet'}
                        </span>
                        <span class="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 border border-transparent dark:border-slate-700">
                            🔁 ${med.frequency || 'Daily'}
                        </span>
                    </div>

                    <!-- Action buttons -->
                    <div class="flex gap-3">
                        <button
                            id="taken-btn-${med._id}"
                            class="flex-1 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg dark:shadow-none shadow-emerald-100
                                   hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                            </svg>
                            Taken
                        </button>
                        <button
                            id="snooze-btn-${med._id}"
                            class="flex-1 py-4 bg-amber-50 text-amber-600 font-bold rounded-2xl border border-amber-100
                                   hover:bg-amber-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Snooze 10 min
                        </button>
                    </div>
                </div>
            </div>

            <style>
                @keyframes slideUpAlert {
                    from { opacity: 0; transform: translateY(40px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        // "Taken" button
        document.getElementById(`taken-btn-${med._id}`).addEventListener('click', async () => {
            // Cancel any pending snooze for this med
            if (snoozeTimers[med._id]) {
                clearTimeout(snoozeTimers[med._id]);
                delete snoozeTimers[med._id];
            }
            overlay.remove();
            await markTaken(med._id);

            // Show a brief success toast
            const toast = document.createElement('div');
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm flex items-center gap-2';
            toast.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                ${med.name} marked as taken!
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        });

        // "Snooze" button — re-fires after 10 minutes
        document.getElementById(`snooze-btn-${med._id}`).addEventListener('click', () => {
            overlay.remove();

            // Cancel any previous snooze timer for this med
            if (snoozeTimers[med._id]) clearTimeout(snoozeTimers[med._id]);

            // Show a snooze confirmation toast
            const toast = document.createElement('div');
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-amber-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm flex items-center gap-2';
            toast.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Snoozed! Reminder in 10 minutes.
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3500);

            // Schedule the snooze re-alert after 10 minutes
            snoozeTimers[med._id] = setTimeout(() => {
                delete snoozeTimers[med._id];
                sendNotification(med, true);
                showMedAlert(med, true);
            }, 10 * 60 * 1000);
        });
    }

    /**
     * Request browser notification permission and fire a system notification
     */
    async function sendNotification(med, isSnooze = false) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        if (Notification.permission === 'granted') {
            const n = new Notification(
                isSnooze ? `⏰ Snooze Over – Take ${med.name}` : `⏰ Time to take ${med.name}`,
                {
                    body: `${med.time} · ${med.dosage || '1 Tablet'} · ${med.frequency || 'Daily'}`,
                    icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.name,
                    tag: `med-${med._id}`,
                    requireInteraction: true
                }
            );
            n.onclick = () => { window.focus(); n.close(); };
        }
    }

    /**
     * Main polling tick — runs every 30 seconds
     */
    async function tick() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const minuteKey = currentHour * 60 + currentMinute;

        // Reset dedup set each new minute
        if (minuteKey !== lastCheckedMinute) {
            notifiedThisMinute.clear();
            lastCheckedMinute = minuteKey;
        }

        try {
            const [meds, logs] = await Promise.all([
                apiFetch('/medicines'),
                apiFetch('/logs')
            ]);
            if (!Array.isArray(meds)) return;

            const todayStr = new Date().toDateString();
            const todayLogs = Array.isArray(logs) ? logs.filter(l => new Date(l.date).toDateString() === todayStr) : [];

            // Sync check: If count changed, refresh dashboard UI
            if (lastMedCount !== -1 && meds.length !== lastMedCount) {
                if (window.renderPatientView) window.renderPatientView();
            }
            lastMedCount = meds.length;

            for (const med of meds) {
                if ((med.status || 'active') !== 'active') continue;
                if (!isMedicineDueToday(med)) continue; // skip if not scheduled for today
                
                // Skip if already taken/skipped today
                const isLogged = todayLogs.some(l => l.medicine?._id === med._id || l.medicine === med._id);
                if (isLogged) continue;

                if (notifiedThisMinute.has(med._id)) continue;

                const parsed = parseTime12h(med.time);
                if (!parsed) continue;

                if (parsed.hours === currentHour && parsed.minutes === currentMinute) {
                    notifiedThisMinute.add(med._id);
                    await sendNotification(med);
                    showMedAlert(med);
                }
            }

            // Also refresh dashboard if the minute changed to keep countdowns accurate
            if (minuteKey !== lastCheckedMinute && window.renderPatientView) {
                window.renderPatientView();
            }
        } catch (err) {
            console.warn('[Scheduler] Tick error:', err.message);
        }
    }

    // Start immediately, then poll every 10 seconds
    tick();
    setInterval(tick, 10 * 1000);

    // Refresh dashboard when user returns to the tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (window.initDashboard) window.initDashboard();
        }
    });

    console.log('[MedRemind Scheduler] Running for', user.name);
})();
