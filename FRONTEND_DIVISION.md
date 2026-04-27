# Frontend Work Division Plan (3 People)

This document outlines the division of frontend tasks for the MedRemind project among three developers.

## Person 1: Authentication & User Management
**Files:** `index.html`, `register.html`, `profile.html`, `auth.js`, `api.js`.
- Handle Login/Registration flows.
- Manage user session states and JWT storage.
- Implement User Profile updates.
- Ensure API configuration and error handling are robust.

## Person 2: Core Medication & Scheduling
**Files:** `medicines.html`, `dashboard.html`, `medicines.js`, `dashboard.js`, `scheduler.js`, `reminder.js`.
- Build the medicine inventory (Add/Edit/Delete).
- Implement the Daily Dashboard checklist.
- Develop the scheduling logic and notification triggers.
- Manage real-time updates for upcoming doses.

## Person 3: Data Analytics, Admin & UI System
**Files:** `history.html`, `admin.html`, `history.js`, `admin.js`, `style.css`, `layout.js`.
- Create history visualization (taken vs. missed doses).
- Build the Admin dashboard for system oversight.
- Maintain the global CSS design system and responsive layouts.
- Develop reusable components (Navbar, Footer, Modals).

---

## Collaboration Guidelines
- **Branches:** Use `feature/auth`, `feature/meds`, and `feature/admin`.
- **Styling:** Follow the styles defined in `style.css` to maintain visual consistency.
- **Communication:** Regularly sync with the backend team for API endpoint updates.
