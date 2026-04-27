const express = require('express');
const router = express.Router();
const { getPatients, getMyPatients, linkPatient, unlinkPatient, updateProfile, getProfile } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Route to fetch all patients (intended for doctor access)
router.get('/patients', protect, getPatients);
// Route to fetch patients linked specifically to the logged-in caregiver
router.get('/my-patients', protect, getMyPatients);
// Route to link a new patient to a caregiver or doctor's account
router.post('/link-patient', protect, linkPatient);
// Route to unlink a patient
router.post('/unlink-patient', protect, unlinkPatient);
// Route to update the profile information of the currently logged-in user
router.put('/profile', protect, updateProfile);
// Route to retrieve the profile information of the currently logged-in user
router.get('/profile', protect, getProfile);

// Alerts
const { sendAlert, getAlerts, dismissAlert } = require('../controllers/userController');
// Route to send a new alert/notification to a patient
router.post('/alert', protect, sendAlert);
// Route to fetch all unread alerts for the currently logged-in patient
router.get('/alerts', protect, getAlerts);
// Route to dismiss (mark as read) a specific alert by its ID
router.put('/alerts/:id/dismiss', protect, dismissAlert);

module.exports = router;
