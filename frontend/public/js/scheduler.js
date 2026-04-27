/**
 * MedRemind – Real-Time Medication Scheduler
 * Runs only on the patient dashboard.
 * Shows a modal alert with "Taken" and "Snooze" (10 min) options.
 */

// Immediately invoked function expression to isolate the scheduler logic
(function initScheduler() {
    // Retrieve user data from localStorage to check roles and permissions
    const user = JSON.parse(localStorage.getItem('user'));
    // If no user is logged in or the user is not a patient, stop the scheduler
    if (!user || user.role !== 'patient') return;

    // A Set to track which medicines have already triggered an alert in the current minute (prevents duplicate alerts)
    const notifiedThisMinute = new Set();
    // Keeps track of the last minute we checked to know when a new minute starts
    let lastCheckedMinute = -1;

    // An object to store active snooze timers so we can cancel them if needed (key: medicine ID, value: timeout ID)
    const snoozeTimers = {};

    // Remembers the medicine count from the last check to detect if the list was updated remotely
    let lastMedCount = -1;

    /**
     * Helper function to convert a 12-hour time string (e.g., "08:30 AM") into a 24-hour object { hours, minutes }
     */
    function parseTime12h(timeStr) {
        // If the string is empty or null, return nothing
        if (!timeStr) return null;
        // Use a regular expression to extract hours, minutes, and AM/PM modifier
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        // If the format doesn't match, return null
        if (!match) return null;
        // Parse the hours as a number
        let h = parseInt(match[1], 10);
        // Parse the minutes as a number
        const m = parseInt(match[2], 10);
        // Normalize the period to uppercase for comparison
        const period = match[3].toUpperCase();
        // Convert 12 AM to 0 hours
        if (period === 'AM' && h === 12) h = 0;
        // Convert PM times (except 12 PM) to 24-hour format by adding 12
        if (period === 'PM' && h !== 12) h += 12;
        // Return the final hours and minutes object
        return { hours: h, minutes: m };
    }

    /**
     * Logic to determine if a specific medicine is due to be taken today based on its frequency setting
     */
    function isMedicineDueToday(med) {
        // Normalize frequency to lowercase for easier matching
        const freq = (med.frequency || 'Daily').toLowerCase();
        // Get the current day of the week (0 for Sunday, 6 for Saturday)
        const todayDay = new Date().getDay(); 

        // If frequency is weekly, check if today is in the allowed days array
        if (freq === 'weekly') {
            const days = Array.isArray(med.daysOfWeek) ? med.daysOfWeek : [];
            return days.includes(todayDay);
        }

        // If frequency is "every other day", calculate days since start date
        if (freq === 'every other day') {
            // Get the start date of the medication or fallback to now
            const start = new Date(med.startDate || med.date || Date.now());
            // Create a midnight reference for the start date
            const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            // Create a midnight reference for today
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);
            // Calculate the total number of days between start and today
            const diffDays = Math.round((todayMidnight - startMidnight) / (1000 * 60 * 60 * 24));
            // Return true if the difference is an even number (every 2nd day)
            return diffDays % 2 === 0;
        }

        // For Daily or As Needed, the medicine is always due every day
        return true;
    }

    /**
     * Sends a POST request to the backend to log that a medicine was taken
     */
    async function markTaken(medId) {
        try {
            // Call the shared apiFetch utility to create a new medication log
            await apiFetch('/logs', {
                method: 'POST',
                body: JSON.stringify({ medicineId: medId, status: 'taken' })
            });
        } catch (e) {
            // Log a warning if the API call fails
            console.warn('[Scheduler] Could not log taken status:', e.message);
        }
        // Force the patient dashboard to re-render and reflect the new "taken" status
        if (window.renderPatientView) window.renderPatientView();
    }

    /**
     * Renders a premium, non-blocking modal on the screen when a dose is due
     */
    function showMedAlert(med, isSnooze = false) {
        // Clean up any existing alert for this same medicine to prevent UI clutter
        document.getElementById(`med-alert-${med._id}`)?.remove();

        // Create a full-screen overlay for the alert
        const overlay = document.createElement('div');
        // Set a unique ID for targeting
        overlay.id = `med-alert-${med._id}`;
        // Apply Tailwind classes for fixed positioning, backdrop blur, and centering
        overlay.className = 'fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-0';
        // Apply semi-transparent background via inline style
        overlay.style.background = 'rgba(15,23,42,0.55)';
        // Apply backdrop blur effect
        overlay.style.backdropFilter = 'blur(4px)';

        // Inject the HTML structure for the alert card
        overlay.innerHTML = `
            <div
                id="med-alert-card-${med._id}"
                class="relative w-full max-w-sm bg-white rounded-[2rem] shadow-2xl dark:shadow-none overflow-hidden"
                style="animation: slideUpAlert 0.35s cubic-bezier(.16,1,.3,1)"
            >
                <!-- Decorative colorful bar at the top -->
                <div class="h-1.5 w-full bg-gradient-to-r from-sky-400 to-blue-600"></div>

                <div class="p-8">
                    <!-- Section for the icon and heading -->
                    <div class="flex items-center gap-5 mb-6">
                        <!-- Icon container with light blue background -->
                        <div class="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center shrink-0">
                            <!-- SVG for a bell notification icon -->
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-9 h-9 text-sky-500" fill="none"
                                viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
                                    00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
                                    .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                            </svg>
                        </div>
                        <div>
                            <!-- Label text: changes based on whether it's a first alert or a snooze reminder -->
                            <p class="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mb-0.5">
                                ${isSnooze ? 'Snooze Over – Medicine Due' : 'Time to Take Your Medicine'}
                            </p>
                            <!-- Large heading showing the medicine name -->
                            <h3 class="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">${med.name}</h3>
                        </div>
                    </div>

                    <!-- Details pills showing time, dosage, and frequency -->
                    <div class="flex gap-3 mb-8">
                        <span class="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 border border-transparent dark:border-slate-700">
                            🕐 ${med.time}
                        </span>
                        <span class="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 border border-transparent dark:border-slate-700">
                            💊 ${med.dosage || '1 Tablet'}
                        </span>
                        <span class="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 border border-transparent dark:border-slate-700">
                            🔁 ${med.frequency || 'Daily'}
                        </span>
                    </div>

                    <!-- Footer buttons: Mark as Taken or Snooze -->
                    <div class="flex gap-3">
                        <button
                            id="taken-btn-${med._id}"
                            class="flex-1 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg dark:shadow-none shadow-emerald-100
                                   hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <!-- Checkmark icon -->
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
                            <!-- Clock icon for snooze -->
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
                /* Animation for the alert sliding up from the bottom */
                @keyframes slideUpAlert {
                    from { opacity: 0; transform: translateY(40px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
            </style>
        `;

        // Add the alert to the body of the page
        document.body.appendChild(overlay);

        // Click handler for the "Taken" button
        document.getElementById(`taken-btn-${med._id}`).addEventListener('click', async () => {
            // If there was a snooze timer running for this medicine, stop it
            if (snoozeTimers[med._id]) {
                clearTimeout(snoozeTimers[med._id]);
                delete snoozeTimers[med._id];
            }
            // Remove the alert from the screen
            overlay.remove();
            // Call the function to update the database
            await markTaken(med._id);

            // Create a temporary success message (toast)
            const toast = document.createElement('div');
            // Style the toast as a green banner at the top
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm flex items-center gap-2';
            // Add text and check icon to the toast
            toast.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                ${med.name} marked as taken!
            `;
            // Show the toast
            document.body.appendChild(toast);
            // Hide the toast after 3 seconds
            setTimeout(() => toast.remove(), 3000);
        });

        // Click handler for the "Snooze" button
        document.getElementById(`snooze-btn-${med._id}`).addEventListener('click', () => {
            // Remove current alert
            overlay.remove();

            // Prevent stacking snooze timers by cancelling any previous one
            if (snoozeTimers[med._id]) clearTimeout(snoozeTimers[med._id]);

            // Create a yellow snooze confirmation toast
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
            // Remove confirmation after 3.5 seconds
            setTimeout(() => toast.remove(), 3500);

            // Set a timer to trigger the alert again after 10 minutes (600,000 milliseconds)
            snoozeTimers[med._id] = setTimeout(() => {
                // Clear the timer from our tracking object
                delete snoozeTimers[med._id];
                // Trigger both the system notification and the in-page alert
                sendNotification(med, true);
                showMedAlert(med, true);
            }, 10 * 60 * 1000);
        });
    }

    /**
     * Fires a native browser notification (Desktop alert)
     */
    async function sendNotification(med, isSnooze = false) {
        // If the browser doesn't support notifications, do nothing
        if (!('Notification' in window)) return;

        // If user hasn't decided on permissions yet, ask for them
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        // If permissions are granted, fire the notification
        if (Notification.permission === 'granted') {
            const n = new Notification(
                // Subject line based on alert type
                isSnooze ? `⏰ Snooze Over – Take ${med.name}` : `⏰ Time to take ${med.name}`,
                {
                    // Details about the dose
                    body: `${med.time} · ${med.dosage || '1 Tablet'} · ${med.frequency || 'Daily'}`,
                    // Dynamic icon based on user avatar
                    icon: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.name,
                    // Unique tag prevents duplicate system notifications for the same medicine
                    tag: `med-${med._id}`,
                    // Notification stays on screen until the user acts on it
                    requireInteraction: true
                }
            );
            // When user clicks the notification, bring the browser tab into focus
            n.onclick = () => { window.focus(); n.close(); };
        }
    }

    /**
     * The core loop function that checks the current time against medication schedules
     */
    async function tick() {
        // Get the current time
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        // Calculate minutes since midnight (e.g., 08:30 -> 510 minutes)
        const minuteKey = currentHour * 60 + currentMinute;

        // If a new minute has started, clear the "already notified" set
        if (minuteKey !== lastCheckedMinute) {
            notifiedThisMinute.clear();
            lastCheckedMinute = minuteKey;
        }

        try {
            // Fetch the latest medicine list and today's logs from the backend
            const [meds, logs] = await Promise.all([
                apiFetch('/medicines'),
                apiFetch('/logs')
            ]);
            // If data is invalid, stop the check
            if (!Array.isArray(meds)) return;

            // Filter the logs to find items marked today
            const todayStr = new Date().toDateString();
            const todayLogs = Array.isArray(logs) ? logs.filter(l => new Date(l.date).toDateString() === todayStr) : [];

            // Detect if a medicine was added or removed by checking the count
            if (lastMedCount !== -1 && meds.length !== lastMedCount) {
                // Refresh the visual dashboard to match the new count
                if (window.renderPatientView) window.renderPatientView();
            }
            // Update the stored count
            lastMedCount = meds.length;

            // Loop through every medication in the user's list
            for (const med of meds) {
                // Ignore medicines that are paused or inactive
                if ((med.status || 'active') !== 'active') continue;
                // Ignore medicines that are not scheduled for the current day of the week
                if (!isMedicineDueToday(med)) continue; 
                
                // Skip this medicine if the user has already taken or skipped it today
                const isLogged = todayLogs.some(l => l.medicine?._id === med._id || l.medicine === med._id);
                if (isLogged) continue;

                // Skip if we already alerted the user for this medicine during THIS minute
                if (notifiedThisMinute.has(med._id)) continue;

                // Parse the medicine's scheduled time string
                const parsed = parseTime12h(med.time);
                if (!parsed) continue;

                // Check if the current hour and minute match the scheduled hour and minute
                if (parsed.hours === currentHour && parsed.minutes === currentMinute) {
                    // Mark as notified so we don't alert again in 10 seconds
                    notifiedThisMinute.add(med._id);
                    // Fire system notification
                    await sendNotification(med);
                    // Show on-screen alert modal
                    showMedAlert(med);
                }
            }

            // If the minute changed, force a UI refresh to keep the "Countdown" clocks accurate
            if (minuteKey !== lastCheckedMinute && window.renderPatientView) {
                window.renderPatientView();
            }
        } catch (err) {
            // Log any errors that happen during the polling process
            console.warn('[Scheduler] Tick error:', err.message);
        }
    }

    // Run the check immediately on page load
    tick();
    // Schedule the check to run every 10 seconds thereafter
    setInterval(tick, 10 * 1000);

    // If the user minimizes the tab and comes back later, refresh the dashboard data
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (window.initDashboard) window.initDashboard();
        }
    });

    // Final log to confirm the background engine is active
    console.log('[MedRemind Scheduler] Running for', user.name);
})();
