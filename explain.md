# Frontend Role Documentation: Person 2
## 👤 Dashboard + Alerts + Scheduler

This document provides a comprehensive technical and functional breakdown of the responsibilities assigned to **Person 2**. This role is considered the "Core Engine" of the MedRemind application, focusing on real-time interactivity, dashboard logic, and the medication scheduling system.

---

### 📄 Primary Pages
*   **dashboard.html**: The central hub for all user types. It is a dynamic page that morphs based on whether the logged-in user is a **Patient**, **Caregiver**, or **Doctor**.

### 📁 Core Logic Files (JavaScript)
*   **js/dashboard.js**: Manages the rendering of role-specific views, data fetching for daily schedules, and handling user interactions with the dashboard.
*   **js/scheduler.js**: The background engine responsible for time-calculations, alert triggers, and the "Next Dose" countdown system.

---

### 🎯 Detailed Responsibilities

#### 1. Patient Dashboard Experience
*   **Today’s Medicines**: Logic to filter the entire medication list to show only what is due *now* or *today*. This involves complex date-time comparisons.
*   **Progress Bar**: A visual component that updates in real-time as medications are marked "Taken." It provides immediate positive reinforcement.
*   **Adherence Stats**: Calculating long-term health trends, such as "Streak Days" and "Percentage of Doses Taken vs Missed."

#### 2. Caregiver Dashboard (Monitoring)
*   **Patient Monitoring**: A specialized view allowing caregivers to see the status of multiple linked patients simultaneously.
*   **Alerts Panel**: A critical list of notifications regarding patients who have missed their doses, allowing for immediate follow-up.

#### 3. Doctor Dashboard (Clinical UI)
*   **Patient Overview**: A high-level directory of patients assigned to the doctor, showing their general adherence scores and current medication count.

#### 4. Real-time System (The "Brains")
*   **Medication Alerts**: Using browser notifications and on-screen "Toasts" to ensure users never miss a dose.
*   **Snooze Logic**: State management for alerts that are temporarily dismissed (e.g., "Remind me again in 15 minutes").
*   **Auto Polling**: Implementing a "Heartbeat" system that periodically checks the server for new data without requiring a manual page refresh.

#### 5. UI Features & Polish
*   **Modals**: Implementing accessible, high-performance pop-ups for data input (e.g., recording a clinical visit or adding a new prescription).
*   **Toast Notifications**: A standardized feedback system for success/error messages (e.g., "Dose recorded successfully").
*   **Animations**: Using CSS and JS to provide smooth transitions, making the application feel premium and responsive.

---

### ⚖️ Workload Complexity: **High**
The complexity of this role is driven by **Temporal Logic** (handling time). Unlike static pages, the Dashboard and Scheduler must handle:
1.  **State Synchronization**: Ensuring the UI updates the moment a timer hits zero.
2.  **Concurrency**: Managing multiple alerts and timers running simultaneously in the browser background.
3.  **UI Density**: Fitting a massive amount of critical information (meds, stats, alerts) into a clean, easy-to-read interface.

---
> [!IMPORTANT]
> Person 2 is responsible for the "Life" of the application. If the logic in `scheduler.js` fails, the core value of the product (reminding people to take medicine) is lost.
