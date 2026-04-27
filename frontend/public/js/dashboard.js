// Retrieve the current user object from localStorage to determine roles and ID
const user = JSON.parse(localStorage.getItem('user'));

// Wait for the browser to finish loading the initial HTML structure
document.addEventListener('DOMContentLoaded', () => {
    // If no user is logged in, immediately kick them back to the login page
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    // Start the dashboard loading process
    initDashboard();

    // Set up a heartbeat that refreshes the dashboard every 30 seconds
    setInterval(() => {
        // Log to the console for debugging purposes
        console.log('[Dashboard] Auto-refreshing data...');
        // Re-run the initialization logic to pull latest data from the server
        initDashboard();
    }, 30000); // 30,000ms = 30s
});

/**
 * The primary entry point for the dashboard UI.
 * Decides which role-specific view to show.
 */
window.initDashboard = async function initDashboard() {
    // Reference the main app container where we will inject HTML
    const container = document.getElementById('dashboard-app');

    // Route the UI generation based on the user's role
    if (user.role === 'doctor') {
        // Show the list of managed patients
        await renderDoctorView(container);
    } else if (user.role === 'caregiver') {
        // Show the list of patients the caregiver is monitoring
        await renderCaregiverView(container);
    } else {
        // Default to patient view: setup the layout shell first
        await renderPatientContainer(container);
        // Then populate it with medication schedule and stats
        await renderPatientView();
    }
    // Initialize Lucide icons for any newly injected HTML
    lucide.createIcons();
}

window.renderPatientView = renderPatientView;

/**
 * Determines if a medication is relevant for "Today".
 * Handles complex scheduling like Weekly (specific days) or Every Other Day.
 */
function isMedicineDueToday(med) {
    // Get the frequency string (e.g., "Daily", "Weekly")
    const freq = (med.frequency || 'Daily').toLowerCase();
    // Get numeric day of week (0-6)
    const todayDay = new Date().getDay(); 

    // Logic for weekly schedules
    if (freq === 'weekly') {
        // Access the array of days (e.g., [1, 3] for Mon/Wed)
        const days = Array.isArray(med.daysOfWeek) ? med.daysOfWeek : [];
        // Return true if today's day is in that list
        return days.includes(todayDay);
    }

    // Logic for "Every Other Day" schedules
    if (freq === 'every other day') {
        // Calculate the difference in days between medicine start and today
        const start = new Date(med.startDate || med.date || Date.now());
        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        // Calculate raw day difference
        const diffDays = Math.round((todayMidnight - startMidnight) / (1000 * 60 * 60 * 24));
        // Only return true if it's an even numbered day relative to the start
        return diffDays % 2 === 0;
    }

    // Default: Daily or As Needed medicines show up every day
    return true;
}

async function renderPatientContainer(container) {
    container.innerHTML = `
        <!-- Next Dose Section -->
        <div id="next-dose-hero" class="mb-10"></div>

        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12 lg:col-span-8 space-y-8">
                <section>
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-3xl font-display font-black text-slate-700 dark:text-slate-200">Daily Quests</h3>
                        <div id="schedule-meta" class="text-xs font-black text-slate-400 uppercase tracking-widest"></div>
                    </div>
                    <!-- Task 4 & 10: Schedule List with Status -->
                    <div id="med-schedule" class="space-y-4"></div>
                </section>

            </div>

            <!-- Gamified Progress Section -->
            <div class="col-span-12 lg:col-span-4 space-y-6">
                <div class="card-white p-6 border-b-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                            <i data-lucide="zap" class="text-warning w-6 h-6 streak-flame"></i>
                            <h4 class="text-lg font-display font-black text-slate-700 dark:text-slate-200">Daily Progress</h4>
                        </div>
                        <span id="daily-progress-pct" class="text-lg font-black text-warning">0%</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-700 h-6 rounded-2xl overflow-hidden mb-6 border-2 border-slate-200 dark:border-slate-600 shadow-inner">
                        <div id="daily-progress-bar" class="bg-warning h-full transition-all duration-1000 relative">
                            <div class="absolute top-1 left-2 right-2 h-1.5 bg-white/30 rounded-full"></div>
                        </div>
                    </div>
                    <div class="h-32">
                        <canvas id="weekly-progress-chart"></canvas>
                    </div>
                </div>

                <div class="card-white p-6 border-b-4">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary border-b-4 border-secondary/20">
                            <i data-lucide="bird" class="w-5 h-5"></i>
                        </div>
                        <h4 class="text-lg font-display font-black text-slate-700 dark:text-slate-200">Coach Duo</h4>
                    </div>
                    <div id="patient-insights" class="text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-600 relative">
                        <div class="absolute -top-2 left-6 w-4 h-4 bg-slate-50 dark:bg-slate-700 border-l-2 border-t-2 border-slate-200 dark:border-slate-600 rotate-45"></div>
                        <p class="italic text-slate-400">Thinking...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}/**
 * Populates the patient dashboard with live data.
 * Fetches meds, logs, and stats, then builds the schedule and hero section.
 */
async function renderPatientView() {
    // Track current time for countdowns and alerts
    const now = new Date();
    // Human-readable date string for the header
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    try {
        // Parallel fetch all data needed to minimize loading time
        const [meds, logs, stats] = await Promise.all([
            apiFetch('/medicines'), // The master list of prescriptions
            apiFetch('/logs'),      // History of what was taken/skipped
            apiFetch(`/logs/stats/${user.id || user._id}`) // Aggregated progress data
        ]);

        // Filter the full history logs to only include actions from today
        const todayLogs = logs.filter(log => new Date(log.date).toDateString() === now.toDateString());

        // Helper function to turn "08:30 AM" into "510" (minutes since midnight) for easy sorting
        const timeToMinutes = (t) => {
            const [time, modifier] = t.split(' ');
            let [hrs, mins] = time.split(':');
            if (hrs === '12') hrs = '00';
            if (modifier === 'PM') hrs = parseInt(hrs, 10) + 12;
            return parseInt(hrs, 10) * 60 + parseInt(mins, 10);
        };
        // Get minutes since midnight for right now
        const currentMins = now.getHours() * 60 + now.getMinutes();

        // Process medications: filter by today's schedule, then attach logs and status
        const medsWithStatus = meds
            .filter(med => isMedicineDueToday(med)) // Apply the frequency logic
            .map(med => {
                // Find if this specific medicine has a log entry today
                const log = todayLogs.find(l => l.medicine?._id === med._id || l.medicine === med._id);
                // Attach current status and time key
                return { ...med, status: log ? log.status : 'pending', timeMins: timeToMinutes(med.time), logId: log ? log._id : null };
            }).sort((a, b) => {
                // Sorting Priority: Pending items first, then by time
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return a.timeMins - b.timeMins;
            });

        // Filter for medicines that still need to be taken
        const pendingMeds = medsWithStatus.filter(m => m.status === 'pending');

        try {
            // Check for any urgent system alerts (e.g., missed doses flagged by caregiver)
            const alerts = await apiFetch('/users/alerts');
            let alertsContainer = document.getElementById('patient-alerts-container');
            // Dynamically create the alert container if it doesn't exist
            if (!alertsContainer) {
                const heroParent = document.getElementById('next-dose-hero')?.parentElement;
                if (heroParent) {
                    alertsContainer = document.createElement('div');
                    alertsContainer.id = 'patient-alerts-container';
                    heroParent.insertBefore(alertsContainer, document.getElementById('next-dose-hero'));
                }
            }
            // Render alert cards if we have data
            if (alertsContainer) {
                if (alerts && alerts.length > 0) {
                    alertsContainer.innerHTML = alerts.map(a => `
                    <div id="alert-${a._id}" class="mb-4 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl flex items-center justify-between shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-rose-100 rounded-lg text-rose-600">
                                <i data-lucide="${a.type === 'medicine' ? 'pill' : 'bell-ring'}" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <p class="text-rose-800 font-bold text-sm">${a.message}</p>
                                <p class="text-rose-500 text-xs mt-0.5">${new Date(a.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <!-- Button to resolve the alert immediately -->
                            ${a.type === 'medicine' && a.medicineId ? `
                                <button onclick="logMedFromAlert('${a.medicineId}', '${a._id}')" class="px-3 py-1.5 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-rose-600 transition-all shadow-sm">
                                    Take
                                </button>
                            ` : ''}
                            <!-- Button to dismiss the warning -->
                            <button onclick="dismissAlert('${a._id}')" class="text-rose-400 hover:text-rose-600 p-2">
                                <i data-lucide="x" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
                } else {
                    // Hide container if no alerts
                    alertsContainer.innerHTML = '';
                }
                // Draw icons for the alerts
                lucide.createIcons();
            }
        } catch (e) { console.error('Failed to fetch alerts', e); }

        // Reference to the large "Hero" section at the top of the dashboard
        const heroEl = document.getElementById('next-dose-hero');

        // Stop any old countdown timers before starting a new one
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
        }

        // Logic to build the Hero Section
        if (heroEl) {
            // Scenario 1: User has no medicines scheduled for today at all
            if (medsWithStatus.length === 0) {
                heroEl.innerHTML = `
                    <div class="bg-slate-100 rounded-[2.5rem] p-10 text-slate-500 dark:bg-slate-800 dark:text-slate-400 relative overflow-hidden text-center border-b-4 border-slate-200 dark:border-slate-700">
                        <div class="w-20 h-20 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border-b-4 border-slate-200 dark:border-slate-600">
                            <i data-lucide="moon" class="w-10 h-10 text-slate-400"></i>
                        </div>
                        <h3 class="text-3xl font-display font-black text-slate-700 dark:text-slate-200">Rest Easy!</h3>
                        <p class="mt-2 text-lg font-bold">You have no medications scheduled for today.</p>
                        <a href="/medicines.html" class="inline-block mt-6 px-6 py-3 bg-primary text-white rounded-xl font-bold uppercase tracking-wider border-b-4 border-primary-dark active:border-b-0 active:translate-y-1 transition-all">Add Medicine</a>
                    </div>
                `;
            } 
            // Scenario 2: User had medicines scheduled, and they've taken all of them
            else if (pendingMeds.length === 0) {
                heroEl.innerHTML = `
                    <div class="bg-primary rounded-[2.5rem] p-10 text-white relative overflow-hidden text-center border-b-4 border-primary-dark">
                        <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border-b-4 border-white/30">
                            <i data-lucide="award" class="w-10 h-10 text-white"></i>
                        </div>
                        <h3 class="text-3xl font-display font-black">All caught up!</h3>
                        <p class="mt-2 text-lg font-bold opacity-90">You've completed your daily quest!</p>
                    </div>
                `;
            } 
            // Scenario 3: User has an upcoming or overdue dose
            else {
                const nextMed = pendingMeds[0];
                // Check if the scheduled time is in the future
                const isFuture = nextMed.timeMins > currentMins;

                if (!isFuture) {
                    // Dose is CURRENTLY due or past due - show the "Take Now" CTA
                    heroEl.innerHTML = `
                        <div class="bg-primary rounded-[2.5rem] p-10 text-white relative overflow-hidden border-b-4 border-primary-dark group">
                            <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div class="flex items-center gap-6">
                                    <div class="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shrink-0 border-b-4 border-white/30">
                                        <i data-lucide="pill" class="w-10 h-10"></i>
                                    </div>
                                    <div>
                                        <p class="text-sm font-black uppercase tracking-widest opacity-80 mb-1">Take Now</p>
                                        <h3 class="text-4xl font-display font-black">${nextMed.name}</h3>
                                        <p class="text-lg mt-1 opacity-90 font-bold">${nextMed.time} • ${nextMed.dosage || '1 Tablet'}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 w-full md:w-auto">
                                    <!-- Action button to mark as taken instantly -->
                                    <button onclick="logMed('${nextMed._id}', 'taken')" class="flex-1 md:flex-none px-8 py-4 bg-white text-primary font-black uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-all border-b-4 border-slate-200 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2">
                                        <i data-lucide="check" class="w-5 h-5"></i> Take Now
                                    </button>
                                    <!-- Snooze button for quick delay -->
                                    <button onclick="alert('Snoozed for 10 minutes');" class="px-6 py-4 bg-primary-dark text-white font-black uppercase tracking-wider rounded-xl transition-all border-b-4 border-[#337800] active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2">
                                        <i data-lucide="moon" class="w-5 h-5"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
        } else {
            // Future dose - show "All caught up" AND countdown below it
            heroEl.innerHTML = `
                <!-- Success message for completing current tasks -->
                <div class="bg-primary rounded-[2.5rem] p-8 text-white relative overflow-hidden border-b-4 border-primary-dark text-center mb-6">
                    <h3 class="text-2xl font-display font-black">All caught up for now!</h3>
                    <p class="mt-1 opacity-90 font-bold">You've completed your current quests.</p>
                </div>
                <!-- Countdown card for the next scheduled medication -->
                <div class="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-[2rem] p-6 border-2 border-slate-200 border-b-4 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
                    <div class="flex items-center gap-5 pl-2">
                        <!-- Clock icon with secondary color theme -->
                        <div class="w-16 h-16 bg-secondary text-white rounded-full flex items-center justify-center shrink-0 border-b-4 border-secondary-dark">
                            <i data-lucide="clock" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <!-- Header for the next dose -->
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Next Quest</p>
                            <!-- Name and time of the next medication -->
                            <p class="text-2xl font-display font-black text-slate-700 dark:text-slate-200">${nextMed.name} <span class="text-slate-400 text-sm font-sans font-bold ml-1">at ${nextMed.time}</span></p>
                            <!-- Dosage information -->
                            <p class="text-sm font-bold text-slate-500 mt-0.5">${nextMed.dosage || '1 Tablet'}</p>
                        </div>
                    </div>
                    <!-- The actual countdown timer element -->
                    <div class="px-8 py-5 bg-slate-50 rounded-2xl border-2 border-slate-200 shrink-0 w-full sm:w-auto text-center dark:bg-slate-700 dark:border-slate-600">
                        <p id="countdown-timer" class="text-2xl font-display font-black text-secondary tracking-wide font-mono">--h --m --s</p>
                        <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Remaining</p>
                    </div>
                </div>
            `;

            // Prepare for the real-time countdown clock
            // Split the 12h time string into components (e.g. "08:30" and "PM")
            const [timeStr, modifier] = nextMed.time.split(' ');
            let [hrs, mins] = timeStr.split(':');
            // Handle 12 AM edge case
            if (hrs === '12') hrs = '00';
            // Convert to 24h format for JavaScript Date calculations
            if (modifier === 'PM') hrs = parseInt(hrs, 10) + 12;

            /**
             * Function to calculate and display the remaining time every second
             */
            const updateTimer = () => {
                // Set the target time on a new date object for today
                const targetTime = new Date();
                targetTime.setHours(parseInt(hrs, 10), parseInt(mins, 10), 0, 0);
                // Get the current timestamp
                const now = new Date();
                // Find the difference in milliseconds
                const diffMs = targetTime - now;
                // Target the UI element created above
                const timerEl = document.getElementById('countdown-timer');

                // If the element is gone (e.g. user moved pages), stop the timer loop
                if (!timerEl) {
                    clearInterval(window.countdownInterval);
                    return;
                }

                // If time is up, update text and refresh the view
                if (diffMs <= 0) {
                    timerEl.textContent = "Due now!";
                    clearInterval(window.countdownInterval);
                    // Force a re-render to switch from "Next Quest" to the active "Take Now" banner
                    renderPatientView(); 
                    return;
                }

                // Calculate hours, minutes, and seconds from raw milliseconds
                const h = Math.floor(diffMs / (1000 * 60 * 60));
                const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diffMs % (1000 * 60)) / 1000);

                // Update the timer text with zero-padding (e.g. 05h 09m 01s)
                timerEl.textContent = `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
            };

            // Run once immediately so the user doesn't see "--h --m --s"
            updateTimer(); 
            // Set up a global interval to update every 1 second (1000ms)
            window.countdownInterval = setInterval(updateTimer, 1000);
        }
    }
}

        /**
         * Render the full list of today's medication "Quests" below the hero section.
         */
        const scheduleEl = document.getElementById('med-schedule');
        if (scheduleEl) {
            // Edge Case: User has no scheduled medications today
            if (medsWithStatus.length === 0) {
                scheduleEl.innerHTML = `
                    <div class="card-white flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                        <!-- Icon showing empty state -->
                        <i data-lucide="calendar-x-2" class="w-16 h-16 mb-4 opacity-20"></i>
                        <p class="font-display font-black text-lg">No quests available today</p>
                    </div>
                `;
            } else {
                // Main Loop: Generate HTML for each medication in the schedule
                scheduleEl.innerHTML = medsWithStatus.map(m => {
                    // Default styling for pending medications (Yellow)
                    let statusColor = 'bg-warning text-white border-warning-dark';
                    let statusLabel = 'Pending';
                    let iconBg = 'bg-slate-100 text-slate-400 border-slate-200';

                    // Styling for successfully taken medications (Green)
                    if (m.status === 'taken') {
                        statusColor = 'bg-primary text-white border-primary-dark';
                        statusLabel = 'Completed';
                        iconBg = 'bg-primary text-white border-primary-dark';
                    }
                    // Styling for missed/skipped medications (Red)
                    else if (m.status === 'skipped') {
                        statusColor = 'bg-danger text-white border-danger-dark';
                        statusLabel = 'Missed';
                        iconBg = 'bg-danger text-white border-danger-dark';
                    }

                    return `
                        <!-- Single medication card -->
                        <div class="card-white group hover:border-secondary transition-all">
                            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div class="flex items-center gap-6">
                                    <!-- Visual status indicator circle -->
                                    <div class="w-16 h-16 rounded-full flex items-center justify-center ${iconBg} border-b-4 transition-all relative z-10 shadow-sm">
                                        <i data-lucide="pill" class="w-8 h-8"></i>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-3">
                                            <!-- Medication Name -->
                                            <h4 class="text-xl font-display font-black text-slate-700 dark:text-slate-200">${m.name}</h4>
                                            <!-- Colored status badge -->
                                            <span class="px-3 py-1 ${statusColor} text-[10px] font-black uppercase tracking-wider rounded-lg border-b-2 flex items-center gap-1 shadow-sm">
                                                ${statusLabel}
                                            </span>
                                        </div>
                                        <!-- Time and Dosage details -->
                                        <p class="text-sm text-slate-400 dark:text-slate-500 font-bold mt-1">${m.time} • ${m.dosage || '1 Tablet'}</p>
                                    </div>
                                </div>
                                <!-- Action Buttons (Conditional) -->
                                <div class="flex gap-2 w-full sm:w-auto">
                                    ${m.status === 'pending' ? `
                                        <!-- "Take" button (Green check) -->
                                        <button onclick="logMed('${m._id}', 'taken')" class="flex-1 sm:flex-none px-4 py-3 bg-primary text-white rounded-xl border-b-4 border-primary-dark hover:brightness-110 transition-all active:border-b-0 active:translate-y-1">
                                            <i data-lucide="check" class="mx-auto"></i>
                                        </button>
                                        <!-- "Skip" button (Red X) -->
                                        <button onclick="logMed('${m._id}', 'skipped')" class="flex-1 sm:flex-none px-4 py-3 bg-danger text-white rounded-xl border-b-4 border-danger-dark hover:brightness-110 transition-all active:border-b-0 active:translate-y-1">
                                            <i data-lucide="x" class="mx-auto"></i>
                                        </button>
                                        <!-- "Alert/Snooze" button (Yellow bell) -->
                                        <button onclick="alert('Reminder set for 15 mins')" class="flex-1 sm:flex-none px-4 py-3 bg-slate-100 text-slate-500 rounded-xl border-b-4 border-slate-200 hover:bg-slate-200 transition-all active:border-b-0 active:translate-y-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300">
                                            <i data-lucide="bell-ring" class="mx-auto"></i>
                                        </button>
                                    ` : `
                                        <!-- "Undo" button allows reversing a mistake -->
                                        <button onclick="undoLog('${m.logId}')" class="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl border-b-4 border-slate-200 font-bold uppercase text-xs tracking-wider hover:bg-slate-200 transition-all active:border-b-0 active:translate-y-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300">Undo</button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Task 9: Weekly Chart
        renderWeeklyProgress(stats);

        // Daily Progress Bar
        const takenCount = todayLogs.filter(l => l.status === 'taken').length;
        const totalCount = meds.length || 1;
        const pct = Math.round((takenCount / totalCount) * 100);
        const pctEl = document.getElementById('daily-progress-pct');
        const barEl = document.getElementById('daily-progress-bar');
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (barEl) barEl.style.width = `${pct}%`;

        // Insights / Coach Duo
        const insightsEl = document.getElementById('patient-insights');
        if (insightsEl) {
            if (pct === 100) {
                insightsEl.innerHTML = `
                    <p>Perfect score! You've completed all quests today! Your health stats are maxed out! 🎉</p>
                `;
            } else if (todayLogs.find(l => l.status === 'skipped')) {
                insightsEl.innerHTML = `
                    <p class="text-danger">Oh no, you missed a quest! Don't lose your streak, stay consistent!</p>
                `;
            } else if (pct > 0) {
                insightsEl.innerHTML = `
                    <p>You're on fire! 🔥 Keep taking those meds to reach 100% for today.</p>
                `;
            } else {
                insightsEl.innerHTML = `
                    <p>Ready to start your daily health quests? I'm rooting for you!</p>
                `;
            }
        }

        lucide.createIcons();
    } catch (err) { console.error('Patient view error:', err); }
}

function renderWeeklyProgress(stats) {
    const ctx = document.getElementById('weekly-progress-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: stats.map(s => s.day),
            datasets: [{
                label: 'Adherence %',
                data: stats.map(s => s.percentage),
                backgroundColor: '#10b981', // emerald-500
                borderRadius: 4,
                barThickness: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { display: false }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

async function logVitals() {
    // Replace prompts with a proper modal later, but for Task 5 Phase 2 we keep it simple for now
    const hr = prompt('Heart Rate (BPM):');
    const systolic = prompt('Systolic BP (e.g. 120):');
    const diastolic = prompt('Diastolic BP (e.g. 80):');

    if (hr || (systolic && diastolic)) {
        try {
            await apiFetch('/vitals', {
                method: 'POST',
                body: JSON.stringify({
                    heartRate: parseInt(hr),
                    bloodPressure: { systolic: parseInt(systolic), diastolic: parseInt(diastolic) }
                })
            });
            initDashboard();
        } catch (err) { alert('Failed to log vitals'); }
    }
}

/**
 * Renders the interactive command center for Caregivers.
 * Allows monitoring multiple linked patients in real-time.
 */
async function renderCaregiverView(container) {
    // Set up the structural HTML layout for the Caregiver Hub
    container.innerHTML = `
        <header class="flex items-center justify-between mb-10">
            <div>
                <!-- Main Header with display font -->
                <h2 class="text-3xl font-display font-bold text-slate-800 dark:text-slate-100">Caregiver Hub</h2>
                <p class="text-slate-400 dark:text-slate-500 font-medium mt-1">Monitoring health for your linked family</p>
            </div>
            <div class="flex items-center gap-4">
                <!-- Primary Action: Open the "Link Patient" modal -->
                <button onclick="linkPatient()" class="px-8 py-4 bg-primary dark:bg-sky-600 text-white rounded-2xl font-bold shadow-sm hover:shadow-md transition-all border border-primary dark:shadow-none dark:border-sky-600 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                    <i data-lucide="plus"></i> Link Patient
                </button>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <!-- Alert Center: Shows consolidated logs of missed doses across all patients -->
            <div class="md:col-span-2 card-white p-8">
                <h4 class="text-lg font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                    <i data-lucide="bell" class="text-amber-500 w-5 h-5"></i> Family Health Alerts
                </h4>
                <div id="caregiver-alerts" class="space-y-4">
                    <!-- Default message before data loads -->
                    <p class="text-slate-400 dark:text-slate-500 italic text-sm">No new alerts.</p>
                </div>
            </div>
            
            <!-- Summary Statistic: Number of patients currently failing their adherence goals -->
            <div class="card-white p-8 bg-rose-500 text-white flex flex-col justify-center relative overflow-hidden group">
                <div class="relative z-10">
                    <p class="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-2">Patients At Risk</p>
                    <h3 class="text-5xl font-display font-bold" id="caretaker-risk-count">0</h3>
                </div>
                <!-- Large background decorative icon -->
                <i data-lucide="alert-triangle" class="absolute -right-4 -bottom-4 w-32 h-32 text-white opacity-10 group-hover:scale-110 transition-transform"></i>
            </div>
        </div>

        <!-- Section for individual patient cards -->
        <h3 class="text-xl font-display font-bold text-slate-800 dark:text-slate-100 mb-6">Linked Patients</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8" id="patient-grid">
            <!-- Loading spinner -->
            <div class="col-span-2 py-20 flex justify-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        </div>
    `;

    try {
        // Step 1: Fetch the list of patients associated with this caregiver
        const patients = await apiFetch('/users/my-patients');

        // Step 2: Fetch detailed statistics and logs for EACH patient in parallel
        const patientData = await Promise.all(patients.map(async p => {
            const [stats, logs, vitalsData] = await Promise.all([
                apiFetch(`/logs/stats/${p._id}`),          // Weekly adherence %
                apiFetch(`/logs/patient/${p._id}`),        // Recent medication logs
                apiFetch(`/vitals/stats/${p._id}`).catch(() => []) // Recent vital signs (fallback to empty if none)
            ]);
            // Calculate an average adherence percentage across the week
            const avg = stats.length > 0 ? Math.round(stats.reduce((acc, s) => acc + s.percentage, 0) / stats.length) : 0;
            // Get the most recent single log entry
            const lastLog = logs[0];
            // Check if they skipped any medicine today specifically
            const missedToday = logs.some(l => l.status === 'skipped' && new Date(l.date).toDateString() === new Date().toDateString());
            // Get the most recent vitals reading
            const vitals = vitalsData && vitalsData.length > 0 ? vitalsData[0] : null;

            // Determine current status label for the UI
            const delayed = logs.some(l => l.status === 'pending' && new Date(l.date).toDateString() === new Date().toDateString());
            let status = 'Active';
            if (missedToday) status = 'Missed';
            else if (delayed) status = 'Delayed';

            // Return a merged object with all calculated data
            return { ...p, adherence: avg, lastLog, missedToday, status, vitals };
        }));

        // Step 3: Count how many patients need urgent attention (<70% score or missed dose today)
        const patientsAtRisk = patientData.filter(p => p.adherence < 70 || p.missedToday).length;
        const riskCountEl = document.getElementById('caretaker-risk-count');
        if (riskCountEl) riskCountEl.textContent = patientsAtRisk;

        // Step 4: Inject the generated patient cards into the grid
        const grid = document.getElementById('patient-grid');
        if (patientData.length === 0) {
            // Empty state if no patients linked
            grid.innerHTML = `<div class="col-span-2 card-white py-20 text-center text-slate-400 dark:text-slate-500 font-medium">No patients linked. Click "+ Link Patient" to start.</div>`;
            // Step 4: Inject the generated patient cards into the grid
            grid.innerHTML = patientData.map(p => `
                <div class="card-white group hover:border-primary/30 transition-all">
                    <!-- Patient profile header within the card -->
                    <div class="flex items-center gap-6 mb-8">
                        <div class="relative">
                            <!-- User Avatar generated based on their unique name -->
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}" class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900/50">
                            <!-- A pulsating red dot if the patient has missed a dose today -->
                            ${p.status === 'Missed' ? `<div class="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full border-4 border-white animate-pulse"></div>` : ''}
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center justify-between">
                                <!-- Patient name -->
                                <h4 class="text-xl font-display font-bold text-slate-800 dark:text-slate-100">${p.name}</h4>
                                <!-- Dynamic status badge: color changes based on medication status -->
                                <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md ${p.status === 'Missed' ? 'bg-rose-100 text-rose-600' : p.status === 'Delayed' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} flex items-center gap-1">
                                    <div class="w-1.5 h-1.5 rounded-full bg-current"></div>
                                    ${p.status}
                                </span>
                            </div>
                            <!-- Static label for context -->
                            <p class="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">General Wellness</p>
                        </div>
                    </div>
                    
                    <!-- Adherence progress section -->
                    <div class="space-y-6 mb-8">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Adherence Rate</span>
                                <!-- Color the percentage text based on performance -->
                                <span class="text-sm font-bold ${p.adherence > 80 ? 'text-emerald-500' : 'text-amber-500'}">${p.adherence}%</span>
                            </div>
                            <!-- Background bar for progress -->
                            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <!-- Colored progress fill -->
                                <div class="h-full ${p.adherence > 80 ? 'bg-emerald-500' : 'bg-amber-500'}" style="width: ${p.adherence}%"></div>
                            </div>
                        </div>
                        
                        <!-- Most recent timestamp of medication activity -->
                        <div class="flex items-center gap-3 text-xs">
                            <i data-lucide="clock" class="w-4 h-4 text-slate-300"></i>
                            <span class="text-slate-500 dark:text-slate-400 dark:text-slate-500">Last activity: <span class="text-slate-800 dark:text-slate-100 font-bold">${p.lastLog ? new Date(p.lastLog.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}</span></span>
                        </div>
                    </div>

                    <!-- Critical Warning: Shows up if the patient missed a dose today -->
                    ${p.missedToday ? `
                        <div class="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-600 text-[10px] font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
                            <i data-lucide="alert-triangle" class="w-4 h-4"></i> Missed today's medicine
                        </div>
                    ` : ''}

                    <!-- Vitals Entry: Allows caregiver to manually log vitals for the patient -->
                    <div class="mt-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Vitals Log</span>
                        </div>
                        <div class="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <!-- Heart rate input field -->
                                <label class="block text-[10px] font-bold text-slate-500 mb-1">Heart Rate (BPM)</label>
                                <input type="number" id="hr-${p._id}" placeholder="${p.vitals?.heartRate || '--'}" class="w-full text-sm font-bold p-2 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all">
                            </div>
                            <div>
                                <!-- Blood pressure input fields -->
                                <label class="block text-[10px] font-bold text-slate-500 mb-1">BP (Sys/Dia)</label>
                                <div class="flex gap-1">
                                    <!-- Systolic input -->
                                    <input type="number" id="sys-${p._id}" placeholder="${p.vitals?.bloodPressure?.systolic || '--'}" class="w-full text-sm font-bold p-2 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all text-center">
                                    <span class="text-slate-400 self-center">/</span>
                                    <!-- Diastolic input -->
                                    <input type="number" id="dia-${p._id}" placeholder="${p.vitals?.bloodPressure?.diastolic || '--'}" class="w-full text-sm font-bold p-2 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 outline-none focus:border-primary transition-all text-center">
                                </div>
                            </div>
                        </div>
                        <!-- Button to submit the vitals to the database -->
                        <button onclick="updatePatientVitals('${p._id}')" class="w-full py-2 text-xs font-bold bg-white dark:bg-slate-700 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm">
                            Update Vitals
                        </button>
                    </div>

                    <!-- Action buttons for the patient file and sending urgent alerts -->
                    <div class="flex gap-2">
                        <!-- Opens a detailed history modal -->
                        <button onclick="viewPatientFile('${p._id}', '${p.name}')" class="flex-1 py-3 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm"><i data-lucide="folder-open" class="w-4 h-4"></i> View File</button>
                        <!-- Triggers a high-priority notification for the patient -->
                        <button onclick="sendPatientAlert('${p._id}', '${p.name}')" class="w-12 h-12 flex items-center justify-center bg-amber-50 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"><i data-lucide="zap"></i></button>
                    </div>
                </div>
            `).join('');
        }

        // Task 33: Caregiver Alerts
        const alertsEl = document.getElementById('caregiver-alerts');
        const caregiverAlertsMap = {};
        patientData.forEach(p => {
            if (p.missedToday || p.adherence < 70) {
                caregiverAlertsMap[p._id] = { p, messages: [] };
                if (p.missedToday) caregiverAlertsMap[p._id].messages.push(`Missed dose today`);
                if (p.adherence < 70) caregiverAlertsMap[p._id].messages.push(`Adherence low (${p.adherence}%)`);
            }
        });
        const caregiverAlerts = Object.values(caregiverAlertsMap);

        if (caregiverAlerts.length > 0) {
            alertsEl.innerHTML = caregiverAlerts.map(a => `
                <div class="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 bg-rose-500 rounded-full shrink-0"></div>
                        <p class="text-sm font-medium text-slate-800 dark:text-slate-100"><span class="font-bold">${a.p.name}:</span> ${a.messages.join(' • ')}</p>
                    </div>
                    <button onclick="viewPatientFile('${a.p._id}', '${a.p.name}')" class="text-xs font-bold px-4 py-2 bg-white text-rose-600 rounded-lg shadow-sm dark:shadow-none hover:bg-rose-50 transition-all border border-rose-100 shrink-0">View Patient</button>
                </div>
            `).join('');
        }
        lucide.createIcons();
    } catch (err) { console.error('Caregiver view error:', err); }
}

/**
 * Logic to link a new patient to a caregiver or doctor account using email.
 */
window.linkPatient = function () {
    // Prevent duplicate modals by removing any existing one first
    document.getElementById('link-patient-modal')?.remove();

    // Create the modal backdrop element
    const modal = document.createElement('div');
    modal.id = 'link-patient-modal';
    // Style as a fixed overlay with a blur effect
    modal.className = 'fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    // Inject the modal container and form structure
    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-[2.5rem] shadow-2xl dark:shadow-none w-full max-w-md overflow-hidden">
            <div class="flex items-center justify-between p-8 pb-0">
                <!-- Modal Heading -->
                <h3 class="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">Link Patient</h3>
                <!-- Close Button -->
                <button onclick="document.getElementById('link-patient-modal').remove()" class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-all">&times;</button>
            </div>
            <form id="link-patient-form" class="p-8 space-y-6">
                <div>
                    <!-- Input for the patient's email -->
                    <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">Patient Email Address</label>
                    <input type="email" id="link-patient-email" placeholder="patient@example.com" required
                        class="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                </div>
                <!-- Submit Button -->
                <button type="submit" class="w-full py-4 bg-primary dark:bg-sky-600 text-white font-bold rounded-2xl shadow-sm hover:shadow-md transition-all border border-primary dark:shadow-none dark:border-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Link Patient
                </button>
            </form>
        </div>
    `;
    // Add the modal to the actual page DOM
    document.body.appendChild(modal);

    // If the user clicks on the dark backdrop (outside the white card), close the modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Handle the form submission event
    document.getElementById('link-patient-form').addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page from refreshing
        // Get the email from the input
        const email = document.getElementById('link-patient-email').value.trim();
        // If empty, do nothing
        if (!email) return;

        // Visual feedback: Change button text and disable it during API call
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Linking...';

        try {
            // Call the backend API to associate the patient
            await apiFetch('/users/link-patient', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            // Success: Remove the modal
            modal.remove();
            
            // Create a premium success toast notification
            const toast = document.createElement('div');
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm';
            toast.textContent = 'Patient linked successfully!';
            document.body.appendChild(toast);
            // Auto-hide the toast after 3 seconds
            setTimeout(() => toast.remove(), 3000);
            
            // Refresh the dashboard to show the newly added patient
            initDashboard();
        } catch (err) {
            // Error Handling: Re-enable the button and show an error message
            btn.disabled = false;
            btn.textContent = 'Link Patient';
            // Inject error text into the modal
            const errDiv = document.createElement('p');
            errDiv.className = 'text-sm text-rose-500 font-semibold text-center mt-4';
            errDiv.textContent = err.message || 'Patient not found. Please check the email.';
            e.target.appendChild(errDiv);
            // Clear error message after 3 seconds
            setTimeout(() => errDiv.remove(), 3000);
        }
    });
};

/**
 * Renders the clinical management dashboard for Doctors.
 * Provides a high-level overview of the patient roster and critical alerts.
 */
async function renderDoctorView(container) {
    // Build the structural HTML for the Doctor's Control Center
    container.innerHTML = `
        <header class="flex items-center justify-between mb-12">
            <div>
                <!-- Display heading -->
                <h2 class="text-3xl font-display font-bold text-slate-800 dark:text-slate-100">Clinical Control Center</h2>
                <!-- Subtitle with doctor's name -->
                <p class="text-slate-400 dark:text-slate-500 font-medium mt-1" id="doc-subtitle">Medical Director: ${user.name}</p>
            </div>
            <div class="flex items-center gap-4">
                <!-- Action: Link a new patient under the doctor's care -->
                <button onclick="linkPatient()" class="px-8 py-4 bg-white dark:bg-slate-800 text-primary border border-primary/30 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                    <i data-lucide="user-plus"></i> Link Patient
                </button>
                <!-- Action: Open the medication prescription wizard -->
                <button onclick="addNewPrescription()" class="bg-primary dark:bg-sky-600 text-white px-8 py-4 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all border border-primary dark:shadow-none dark:border-sky-600 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                    <i data-lucide="plus"></i> New Prescription
                </button>
            </div>
        </header>

        <!-- Analytics Strip: Real-time KPIs for the doctor's clinic -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <!-- Metric: Average Adherence Percentage -->
            <div class="card-white p-6 flex items-center gap-6 border-l-4 border-emerald-500">
                <div class="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
                    <i data-lucide="activity" class="w-6 h-6"></i>
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Avg Adherence</p>
                    <h3 class="text-3xl font-display font-bold text-slate-800 dark:text-slate-100" id="doc-avg-adherence">--%</h3>
                </div>
            </div>
            <!-- Metric: High Risk Count (patients below critical thresholds) -->
            <div class="card-white p-6 flex items-center gap-6 border-l-4 border-rose-500">
                <div class="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shrink-0">
                    <i data-lucide="alert-triangle" class="w-6 h-6"></i>
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">High Risk</p>
                    <h3 class="text-3xl font-display font-bold text-slate-800 dark:text-slate-100" id="doc-high-risk-count">--</h3>
                </div>
            </div>
            <!-- Metric: Total number of patients linked to this doctor -->
            <div class="card-white p-6 flex items-center gap-6 border-l-4 border-sky-500">
                <div class="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-500 shrink-0">
                    <i data-lucide="users" class="w-6 h-6"></i>
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Patients</p>
                    <h3 class="text-3xl font-display font-bold text-slate-800 dark:text-slate-100" id="doc-patient-count">--</h3>
                </div>
            </div>
        </div>

        <!-- Task 20: Intelligent Alerts -->
        <div class="card-white p-8 mb-12">
            <div class="flex items-center justify-between mb-8">
                <h4 class="text-lg font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <i data-lucide="bell-ring" class="text-rose-500 w-5 h-5"></i> Critical Care Alerts
                </h4>
            </div>
            <div id="doctor-alerts" class="space-y-4">
                <div class="animate-pulse flex space-x-4">
                    <div class="rounded-full bg-slate-100 h-10 w-10"></div>
                    <div class="flex-1 space-y-2 py-1">
                        <div class="h-2 bg-slate-100 rounded"></div>
                        <div class="h-2 bg-slate-100 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card-white overflow-hidden p-0">
            <div class="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50/30">
                <h3 class="text-xl font-display font-bold text-slate-800 dark:text-slate-100">Patient Directory</h3>
                <div class="flex items-center gap-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <span>Low Risk</span>
                    <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span>Med Risk</span>
                    <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span>High Risk</span>
                    <div class="w-3 h-3 rounded-full bg-rose-500"></div>
                </div>
            </div>
            
            <table class="w-full text-left">
                <thead>
                    <tr class="bg-slate-50 dark:bg-slate-900/50/20">
                        <th class="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Patient</th>
                        <th class="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Adherence</th>
                        <th class="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Last Missed</th>
                        <th class="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Risk Level</th>
                        <th class="px-8 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Vitals (HR/BP)</th>
                        <th class="px-8 py-4 text-right"></th>
                    </tr>
                </thead>
                <tbody id="doctor-patient-list" class="divide-y divide-slate-50"></tbody>
            </table>
        </div>
    `;

    try {
        const patients = await apiFetch('/users/patients');
        document.getElementById('doc-patient-count').textContent = patients.length;

        const patientData = await Promise.all(patients.map(async p => {
            const [stats, logs, vitalsData] = await Promise.all([
                apiFetch(`/logs/stats/${p._id}`),
                apiFetch(`/logs/patient/${p._id}`),
                apiFetch(`/vitals/stats/${p._id}`).catch(() => [])
            ]);
            const avg = stats.length > 0 ? Math.round(stats.reduce((acc, s) => acc + s.percentage, 0) / stats.length) : 0;
            const lastMissed = logs.find(l => l.status === 'skipped');
            const vitals = vitalsData && vitalsData.length > 0 ? vitalsData[0] : null;

            // Task 18: Risk Level Logic
            let risk = 'Low';
            let riskColor = 'text-emerald-500 bg-emerald-50';
            if (avg < 50) { risk = 'High'; riskColor = 'text-rose-500 bg-rose-50'; }
            else if (avg < 80) { risk = 'Medium'; riskColor = 'text-amber-500 bg-amber-50'; }

            return { ...p, adherence: avg, lastMissed, risk, riskColor, logs, vitals };
        }));

        const overallAvg = Math.round(patientData.reduce((acc, p) => acc + p.adherence, 0) / (patientData.length || 1));
        const highRiskCount = patientData.filter(p => p.risk === 'High').length;

        document.getElementById('doc-avg-adherence').textContent = overallAvg + '%';
        const hrCountEl = document.getElementById('doc-high-risk-count');
        if (hrCountEl) hrCountEl.textContent = highRiskCount;

        // Step 1: Target the table body for patient data
        const list = document.getElementById('doctor-patient-list');
        // Step 2: Generate the HTML rows for the directory
        list.innerHTML = patientData.map(p => `
            <!-- Clickable row that opens the full patient record -->
            <tr onclick="viewPatientFile('${p._id}', '${p.name}')" class="hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group border-b border-slate-50/50 dark:border-slate-700/50 cursor-pointer">
                <td class="px-8 py-6">
                    <!-- Column 1: Patient Profile (Image + Name + Email) -->
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shadow-sm dark:shadow-none">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 dark:text-slate-100 text-lg">${p.name}</p>
                            <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">${p.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <!-- Column 2: Adherence Percentage and mini progress bar -->
                    <div class="flex flex-col items-center gap-2">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${p.adherence}%</span>
                        <div class="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <!-- Bar fill based on percentage -->
                            <div class="bg-primary dark:bg-sky-600 h-full transition-all duration-500" style="width: ${p.adherence}%"></div>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-6">
                    <!-- Column 3: The date of their last missed dose, if any -->
                    <p class="text-sm font-bold text-slate-500 dark:text-slate-400">
                        ${p.lastMissed ? new Date(p.lastMissed.date).toLocaleDateString() : 'None Recorded'}
                    </p>
                </td>
                <td class="px-8 py-6">
                    <!-- Column 4: Calculated risk badge -->
                    <span class="px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${p.riskColor} ring-1 ring-inset ${p.risk === 'High' ? 'ring-rose-200' : p.risk === 'Medium' ? 'ring-amber-200' : 'ring-emerald-200'}">${p.risk}</span>
                </td>
                <td class="px-8 py-6">
                    <!-- Column 5: Vitals inputs allowing inline doctor updates -->
                    <div class="flex items-center justify-center gap-1" onclick="event.stopPropagation()">
                        <!-- Heart Rate -->
                        <input type="number" id="hr-${p._id}" placeholder="${p.vitals?.heartRate || 'HR'}" class="w-12 text-xs font-bold p-1.5 rounded border border-slate-200 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary text-center">
                        <!-- Systolic BP -->
                        <input type="number" id="sys-${p._id}" placeholder="${p.vitals?.bloodPressure?.systolic || 'Sys'}" class="w-12 text-xs font-bold p-1.5 rounded border border-slate-200 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary text-center">
                        <span class="text-slate-400">/</span>
                        <!-- Diastolic BP -->
                        <input type="number" id="dia-${p._id}" placeholder="${p.vitals?.bloodPressure?.diastolic || 'Dia'}" class="w-12 text-xs font-bold p-1.5 rounded border border-slate-200 dark:bg-slate-800 dark:border-slate-700 outline-none focus:border-primary text-center">
                        <!-- Save Button -->
                        <button onclick="updatePatientVitals('${p._id}')" class="p-1.5 ml-1 bg-primary text-white rounded hover:bg-primary-dark transition-all">
                            <i data-lucide="save" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
                <td class="px-8 py-6 text-right">
                    <!-- Column 6: Administrative actions -->
                    <div class="flex items-center justify-end gap-2">
                        <!-- "Record" button opens file -->
                        <button class="px-4 py-2 border border-transparent dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-xs hover:border-primary hover:text-primary transition-all flex items-center gap-1"><i data-lucide="folder-open" class="w-3.5 h-3.5"></i> Record</button>
                        <!-- "Remove" button unlinks the patient from the clinic -->
                        <button onclick="event.stopPropagation(); unlinkPatient('${p._id}', '${p.name}')" class="px-4 py-2 bg-rose-50 text-rose-500 font-bold rounded-lg text-xs hover:bg-rose-100 transition-all flex items-center gap-1">
                            <i data-lucide="user-minus" class="w-3.5 h-3.5"></i> Remove
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        /**
         * Step 3: Run the clinical risk detection engine.
         * Identifies patients needing intervention based on adherence or inactivity.
         */
        const alertsEl = document.getElementById('doctor-alerts');
        const alerts = [];
        // Loop through all processed patient data to flag concerns
        patientData.forEach(p => {
            // Flag 1: Low Adherence
            if (p.adherence < 60) alerts.push({ patient: p, type: 'Adherence', msg: `${p.name} adherence dropped below 60% (${p.adherence}%)` });
            
            // Flag 2: Frequent missed doses in a short window
            const missedCount = p.logs.filter(l => l.status === 'skipped' && (new Date() - new Date(l.date)) < 3 * 24 * 60 * 60 * 1000).length;
            if (missedCount >= 3) alerts.push({ patient: p, type: 'Missed Doses', msg: `${p.name} missed ${missedCount} doses in the last 3 days` });

            // Flag 3: Inactivity (no logs recorded at all for 2+ days)
            const lastLog = p.logs[0];
            if (lastLog && (new Date() - new Date(lastLog.date)) > 2 * 24 * 60 * 60 * 1000) {
                alerts.push({ patient: p, type: 'Inactive', msg: `${p.name} has been inactive for 2+ days` });
            }
        });

        // Step 4: Display the alerts or an empty state message
        if (alerts.length === 0) {
            alertsEl.innerHTML = '<p class="text-slate-400 dark:text-slate-500 italic text-center py-4">No critical alerts detected today.</p>';
        } else {
            // Generate warning cards for the doctor
            alertsEl.innerHTML = alerts.map(a => `
                <div class="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-transparent dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-primary/30 transition-all">
                    <div class="flex items-center gap-4">
                        <!-- Warning Icon -->
                        <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                            <i data-lucide="alert-circle" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <!-- Patient Name -->
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-100">${a.patient.name}</p>
                                <!-- Risk Level Badge -->
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${a.patient.riskColor} ring-1 ring-inset ${a.patient.risk === 'High' ? 'ring-rose-200' : 'ring-amber-200'}">${a.patient.risk} Risk</span>
                            </div>
                            <!-- Alert Details -->
                            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">${a.msg}</p>
                            <!-- Alert Category -->
                            <p class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">${a.type}</p>
                        </div>
                    </div>
                    <!-- Quick action to investigate the patient's record -->
                    <button onclick="viewPatientFile('${a.patient._id}', '${a.patient.name}')" class="px-5 py-2.5 bg-white border border-transparent dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-sm dark:shadow-none hover:border-primary hover:text-primary transition-all shrink-0">View Record</button>
                </div>
            `).join('');
        }
        // Redraw icons for the new alerts
        lucide.createIcons();
    } catch (err) { console.error('Doctor view error:', err); }
}

// Explicitly expose to window to ensure HTML onclick can find it
/**
 * Opens a full-screen clinical modal for a specific patient.
 * Displays adherence charts, medication history, and vitals.
 */
window.viewPatientFile = async function (patientId, patientName) {
    // Show a loading overlay immediately to improve perceived performance
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in';
    overlay.id = 'patient-file-modal';
    // Loading spinner inside the overlay
    overlay.innerHTML = '<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>';
    document.body.appendChild(overlay);

    try {
        // Step 1: Parallel fetch all clinical data for this specific patient
        const [meds, logs, stats, vitals] = await Promise.all([
            apiFetch(`/medicines/patient/${patientId}`).catch(() => []), // All prescriptions
            apiFetch(`/logs/patient/${patientId}`).catch(() => []),    // History logs
            apiFetch(`/logs/stats/${patientId}`).catch(() => []),      // Aggregated score
            apiFetch(`/vitals/stats/${patientId}`).catch(() => [])    // Latest vital readings
        ]);

        // Step 2: Calculate summary metrics
        const avgAdherence = (stats && stats.length > 0) ? Math.round(stats.reduce((acc, s) => acc + s.percentage, 0) / stats.length) : 0;
        const latestVitals = (vitals && vitals.length > 0) ? vitals[0] : { heartRate: '--', bloodPressure: { systolic: '--', diastolic: '--' } };

        // Step 3: Inject the modal HTML content
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-[3rem] w-full max-w-5xl max-h-[90vh] shadow-2xl dark:shadow-none overflow-hidden flex flex-col animate-slide-up border border-transparent dark:border-slate-700">
                <!-- Modal Header: Patient Branding -->
                <div class="p-10 border-b border-slate-50 flex items-center justify-between">
                    <div class="flex items-center gap-6">
                        <!-- Large Avatar Box -->
                        <div class="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-700 flex items-center justify-center p-1 shadow-sm dark:shadow-none">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${patientName}" class="w-full h-full rounded-xl object-cover">
                        </div>
                        <div>
                            <!-- Patient Name -->
                            <h3 class="text-4xl font-display font-bold text-[#1e293b]">${patientName}</h3>
                            <p class="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Patient Clinical Record</p>
                        </div>
                    </div>
                    <!-- Close button -->
                    <button onclick="document.getElementById('patient-file-modal').remove()" class="w-12 h-12 hover:bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-slate-400 dark:text-slate-500 flex items-center justify-center transition-all">
                        <i data-lucide="x" class="w-6 h-6"></i>
                    </button>
                </div>

                <!-- Modal Content: Data Tabs/Sections -->
                <div class="flex-1 overflow-y-auto p-10 pt-4 space-y-12">
                    <!-- Dashboard Cards Row (Score, HR, BP) -->
                    <div class="grid grid-cols-3 gap-8">
                        <!-- Adherence Score Card -->
                        <div class="bg-[#ecfdf5] p-8 rounded-[2rem] border border-[#d1fae5] shadow-sm dark:shadow-none">
                            <p class="text-[11px] font-bold text-[#059669] uppercase tracking-wider mb-2">Avg Adherence</p>
                            <h4 class="text-5xl font-display font-bold text-[#059669]">${avgAdherence}%</h4>
                        </div>
                        <!-- Heart Rate Card -->
                        <div class="bg-[#fff1f2] p-8 rounded-[2rem] border border-[#ffe4e6] shadow-sm dark:shadow-none">
                            <p class="text-[11px] font-bold text-[#e11d48] uppercase tracking-wider mb-2">Heart Rate</p>
                            <h4 class="text-5xl font-display font-bold text-[#e11d48]">${latestVitals.heartRate || '--'} <span class="text-sm font-bold opacity-60">BPM</span></h4>
                        </div>
                        <!-- Blood Pressure Card -->
                        <div class="bg-[#f0f9ff] p-8 rounded-[2rem] border border-[#e0f2fe] shadow-sm dark:shadow-none">
                            <p class="text-[11px] font-bold text-[#0284c7] uppercase tracking-wider mb-2">Blood Pressure</p>
                            <h4 class="text-5xl font-display font-bold text-[#0284c7]">${latestVitals.bloodPressure?.systolic || '--'}/${latestVitals.bloodPressure?.diastolic || '--'} <span class="text-sm font-bold opacity-60">mmHg</span></h4>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-16">
                        <!-- Detailed List: Current Active Medications -->
                        <div>
                            <h4 class="text-xl font-display font-bold text-[#1e293b] mb-8 flex items-center gap-3">
                                <i data-lucide="pill" class="text-primary w-6 h-6"></i> Current Prescriptions
                            </h4>
                            <div class="space-y-4">
                                ${meds && meds.length > 0 ? meds.map(m => `
                                    <div class="p-6 bg-slate-50 dark:bg-slate-900/50/50 rounded-[1.5rem] border border-transparent dark:border-slate-700 flex items-center justify-between group hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                                        <div>
                                            <p class="text-lg font-bold text-[#334155] mb-1">${m.name}</p>
                                            <p class="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">${m.time} • ${m.dosage || 'N/A'}</p>
                                        </div>
                                        <span class="text-[9px] font-bold uppercase px-3 py-1.5 bg-[#ecfdf5] text-[#059669] rounded-full border border-[#d1fae5]">Active</span>
                                    </div>
                                `).join('') : '<p class="text-slate-400 dark:text-slate-500 text-sm italic">No active prescriptions.</p>'}
                            </div>
                        </div>

                        <!-- Detailed List: Recent Adherence History -->
                        <div>
                            <h4 class="text-xl font-display font-bold text-[#1e293b] mb-8 flex items-center gap-3">
                                <i data-lucide="activity" class="text-primary w-6 h-6"></i> Recent Logs
                            </h4>
                            <div class="space-y-6">
                                ${logs && logs.length > 0 ? logs.slice(0, 5).map(l => `
                                    <div class="flex items-center gap-4 group">
                                        <!-- Colored status dot -->
                                        <div class="w-2.5 h-2.5 rounded-full ${l.status === 'taken' ? 'bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-[#ef4444] shadow-[0_0_10px_rgba(239,68,68,0.3)]'}"></div>
                                        <div class="flex-1">
                                            <p class="text-sm font-bold text-[#334155]">${l.medicine?.name || 'Unknown'}</p>
                                            <p class="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase mt-1">${new Date(l.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                        </div>
                                        <span class="text-[10px] font-black tracking-widest ${l.status === 'taken' ? 'text-[#059669]' : 'text-[#b91c1c]'} uppercase">${l.status}</span>
                                    </div>
                                `).join('') : '<p class="text-slate-400 dark:text-slate-500 text-sm italic">No recent activity.</p>'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer with global actions -->
                <div class="p-10 border-t border-slate-50 bg-slate-50 dark:bg-slate-900/50/20 flex justify-end gap-6">
                    <button onclick="document.getElementById('patient-file-modal').remove()" class="px-10 py-5 bg-white border border-transparent dark:border-slate-700 text-[#475569] rounded-[1.25rem] font-bold hover:bg-slate-50 dark:bg-slate-900/50 transition-all text-sm">Close Record</button>
                    <!-- Button that bridges to the next wizard -->
                    <button onclick="document.getElementById('patient-file-modal').remove(); addNewPrescription()" class="px-10 py-5 bg-primary dark:bg-sky-600 text-white rounded-[1.25rem] font-bold shadow-sm hover:shadow-md transition-all border border-primary dark:shadow-none dark:border-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm">Adjust Prescription</button>
                </div>
            </div>
        `;
        // Refresh icons within the newly injected HTML
        lucide.createIcons();
    } catch (err) {
        // Step 4: Handle modal load failures
        console.error('Error in viewPatientFile:', err);
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-800 dark:border-slate-700 p-12 rounded-[2rem] shadow-xl dark:shadow-none text-center max-w-sm">
                <div class="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="alert-circle" class="w-8 h-8"></i>
                </div>
                <h3 class="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Load Failed</h3>
                <p class="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mb-6">Could not retrieve clinical records for this patient.</p>
                <button onclick="document.getElementById('patient-file-modal').remove()" class="w-full py-3 bg-slate-100 text-slate-600 dark:text-slate-300 rounded-xl font-bold">Dismiss</button>
            </div>
        `;
        lucide.createIcons();
    }
}



window.addNewPrescription = async function () {
    // Create Modal Overlay
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in';
    modal.id = 'prescription-modal';

    const patients = await apiFetch('/users/patients');

    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl dark:shadow-none overflow-hidden animate-slide-up">
            <div class="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                    <h3 class="text-2xl font-display font-bold text-slate-800 dark:text-slate-100">New Prescription</h3>
                    <p class="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Clinical Authorization</p>
                </div>
                <button onclick="document.getElementById('prescription-modal').remove()" class="p-2 hover:bg-slate-50 dark:bg-slate-900/50 rounded-xl text-slate-400 dark:text-slate-500"><i data-lucide="x"></i></button>
            </div>
            
            <form id="modal-prescription-form" class="p-8 space-y-6">
                <div>
                    <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">Select Patient</label>
                    <select id="modal-patient" class="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all" required>
                        <option value="">Choose a patient...</option>
                        ${patients.map(p => `<option value="${p._id}">${p.name} (${p.email})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">Medication Name</label>
                    <input type="text" id="modal-med-name" placeholder="e.g. Metformin" class="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all" required>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">Time</label>
                        <input type="time" id="modal-med-time" class="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 ml-1">Dosage</label>
                        <input type="text" id="modal-med-dosage" placeholder="500mg" class="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-transparent dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    </div>
                </div>
                <button type="submit" class="w-full py-5 bg-primary dark:bg-sky-600 text-white font-bold rounded-2xl shadow-sm hover:shadow-md transition-all border border-primary dark:shadow-none dark:border-sky-600 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    Authorize Prescription
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    // Step 4: Attach a submission listener to the prescription form
    const form = document.getElementById('modal-prescription-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page reload
        // Select the submit button for feedback
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true; // Disable to prevent double-click
        submitBtn.textContent = 'Processing...'; // Loading state text

        // Convert the HTML5 24-hour time string (e.g., "14:30") into MedRemind's 12-hour format ("02:30 PM")
        const rawTime = document.getElementById('modal-med-time').value;
        const [hStr, mStr] = rawTime.split(':');
        const h24 = parseInt(hStr, 10);
        // Determine AM or PM
        const period = h24 >= 12 ? 'PM' : 'AM';
        // Handle the 12-hour modulus (0 and 12 are both 12)
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        // Pad the hour with a leading zero if necessary
        const time12 = `${String(h12).padStart(2, '0')}:${mStr} ${period}`;

        // Create the payload object for the API request
        const data = {
            user: document.getElementById('modal-patient').value, // The selected patient's ID
            name: document.getElementById('modal-med-name').value, // Medicine name string
            time: time12, // Formatted 12-hour time
            dosage: document.getElementById('modal-med-dosage').value, // Dosage (e.g., "1 pill")
            frequency: 'Daily' // Default frequency to Daily for this project version
        };

        try {
            // Step 5: Send the new medication record to the backend
            await apiFetch('/medicines', { method: 'POST', body: JSON.stringify(data) });
            // Step 6: Close the modal on success
            modal.remove();
            // Refresh the dashboard to show the new prescription in lists
            initDashboard();

            // Step 7: Show a success toast notification
            const toast = document.createElement('div');
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm';
            toast.textContent = 'Prescription authorized!';
            document.body.appendChild(toast);
            // Remove the notification after 3 seconds
            setTimeout(() => toast.remove(), 3000);
        } catch (err) {
            // Step 8: Handle API errors (e.g., validation failed)
            alert('Failed: ' + (err.message || 'Server error'));
            // Re-enable the button so the doctor can fix the form and try again
            submitBtn.disabled = false;
            submitBtn.textContent = 'Authorize Prescription';
        }
    });
}

/**
 * Synthesizes a positive "Ding" sound using the Web Audio API.
 * This provides auditory confirmation that a dose was successfully logged.
 */
function playDingSound() {
    try {
        // Initialize the browser's audio engine
        const context = new (window.AudioContext || window.webkitAudioContext)();
        // Create an oscillator (the sound source)
        const oscillator = context.createOscillator();
        // Create a gain node (the volume control)
        const gainNode = context.createGain();

        // Use a clean sine wave
        oscillator.type = 'sine';
        // Set two frequencies in sequence for a pleasant "chime" effect
        oscillator.frequency.setValueAtTime(880, context.currentTime); // High A (A5)
        oscillator.frequency.setValueAtTime(1108.73, context.currentTime + 0.1); // C#6 (Major third higher)

        // Set starting volume to 100%
        gainNode.gain.setValueAtTime(1, context.currentTime);
        // Exponentially fade out the sound to 1% over 0.4 seconds to prevent clicking/popping
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.4);

        // Connect the source to volume, and volume to speakers
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        // Start playing
        oscillator.start();
        // Stop automatically after the fade out
        oscillator.stop(context.currentTime + 0.4);
    } catch (e) {
        // Fallback for browsers with blocked autoplay or no audio support
        console.log("Audio failed to play", e);
    }
}

/**
 * High-level function to record medication consumption (Taken or Skipped).
 * Includes haptic, auditory, and visual (confetti) rewards.
 */
window.logMed = async function (medId, status) {
    if (status === 'taken') {
        // Play the chime
        playDingSound();
        // Trigger the confetti celebration if the library is loaded
        if (window.confetti) {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                // Use MedRemind's brand colors for confetti
                colors: ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b'],
                gravity: 1.2
            });
        }
    } else if (status === 'skipped') {
        // Provide a subtle haptic vibration for skipped doses if on mobile
        if (navigator.vibrate) navigator.vibrate(200);
    }

    try {
        // Step 1: Send the log entry to the backend API
        await apiFetch('/logs', {
            method: 'POST',
            body: JSON.stringify({ medicineId: medId, status })
        });

        // Step 2: UI Cleanup - Remove the active notification alert card if it was on screen
        document.getElementById(`med-alert-${medId}`)?.remove();

        // Step 3: Refresh the patient view to update progress bars and today's schedule
        await renderPatientView();
    } catch (err) {
        // Step 4: Handle specific errors (like double-logging)
        const msg = err.message || '';
        if (msg.includes('already logged')) {
            alert('This dose has already been logged for today.');
        } else {
            alert('Failed to save log: ' + msg);
        }
    }
};

/**
 * Deletes the most recent log entry for a specific medication.
 * Useful if the user clicked "Taken" by mistake.
 */
window.undoLog = async function (logId) {
    // If no ID provided, do nothing
    if (!logId) return;
    try {
        // Step 1: Call the DELETE endpoint to remove the record
        await apiFetch('/logs/undo', {
            method: 'DELETE',
            body: JSON.stringify({ logId })
        });

        // Step 2: Show a feedback toast for the undo action
        const toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl animate-fade-in text-sm flex items-center gap-2';
        toast.innerHTML = `<i data-lucide="rotate-ccw" class="w-5 h-5"></i> Log Removed`;
        document.body.appendChild(toast);
        // Refresh icons for the toast icon
        lucide.createIcons();

        // Auto-remove toast after 3 seconds
        setTimeout(() => toast.remove(), 3000);

        // Step 3: Refresh the entire dashboard to revert progress bars
        initDashboard();
    } catch (err) {
        console.error('Error undoing log:', err);
    }
};

/**
 * Updates a patient's vital signs (Heart Rate, Systolic/Diastolic BP).
 * Used by caregivers and doctors.
 */
window.updatePatientVitals = async function (userId) {
    // Retrieve values from the dynamic IDs in the UI grid
    const hr = document.getElementById(`hr-${userId}`).value;
    const sys = document.getElementById(`sys-${userId}`).value;
    const dia = document.getElementById(`dia-${userId}`).value;

    // Start with the user ID
    const payload = { userId };
    // Only add fields if they actually have a value entered
    if (hr) payload.heartRate = parseInt(hr, 10);
    if (sys) payload.systolic = parseInt(sys, 10);
    if (dia) payload.diastolic = parseInt(dia, 10);

    // If the doctor clicked update without typing anything, warn them
    if (Object.keys(payload).length === 1) {
        alert("Please enter at least one vital to update.");
        return;
    }

    try {
        // Step 1: Push the new readings to the vitals collection
        await apiFetch('/vitals/update', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // Step 2: Show success notification
        const toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl animate-fade-in text-sm flex items-center gap-2';
        toast.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> Vitals Updated Successfully`;
        document.body.appendChild(toast);
        lucide.createIcons();
        setTimeout(() => toast.remove(), 3000);

        // Step 3: Refresh the dashboard to update placeholders/stats
        initDashboard();
    } catch (err) {
        alert('Failed to update vitals: ' + (err.message || 'Server error'));
    }
};


/**
 * Triggers a manual, high-priority alert notification for a patient.
 */
window.sendPatientAlert = async function (patientId, patientName) {
    try {
        // Call the backend to create an alert record for that user
        await apiFetch('/users/alert', {
            method: 'POST',
            body: JSON.stringify({ patientId })
        });
        // Feedback
        alert('Alert sent to ' + patientName + ' successfully!');
    } catch (e) {
        alert('Failed to send alert.');
        console.error(e);
    }
};

/**
 * Removes an alert notification from the database and UI.
 */
window.dismissAlert = async function (id) {
    try {
        // API call to set alert as dismissed
        await apiFetch(`/users/alerts/${id}/dismiss`, { method: 'PUT' });
        // Remove from the local DOM immediately
        const el = document.getElementById(`alert-${id}`);
        if (el) el.remove();
    } catch (e) { console.error('Failed to dismiss alert', e); }
};

/**
 * Removes a patient from the Caregiver/Doctor's list.
 * Effectively terminates the clinical/caregiver relationship.
 */
window.unlinkPatient = async function (patientId, patientName) {
    // Safety check - confirm deletion
    if (!confirm(`Are you sure you want to remove ${patientName} from your supervision?`)) return;

    try {
        // Step 1: Call the unlink endpoint
        await apiFetch('/users/unlink-patient', {
            method: 'POST',
            body: JSON.stringify({ patientId })
        });

        // Step 2: Show success feedback
        const toast = document.createElement('div');
        toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-xl dark:shadow-none text-sm';
        toast.textContent = `${patientName} has been removed from your list.`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);

        // Step 3: Refresh the list to remove the card/row
        initDashboard();
    } catch (err) {
        alert('Failed to remove patient: ' + (err.message || 'Server error'));
    }
};
