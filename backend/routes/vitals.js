const express = require('express');
const router = express.Router();
const { getMyVitals, addVitals, getPatientVitals, updateVitals } = require('../controllers/vitalsController');
const { protect, authorizeRoles } = require('../middleware/auth');

// Route to get vitals for the currently logged-in user
router.get('/', protect, getMyVitals);
// Route to add a new vitals entry for the currently logged-in user
router.post('/', protect, addVitals);
// Route to get vitals statistics for a specific patient by their user ID
router.get('/stats/:userId', protect, getPatientVitals);
// Route to update existing vitals for a patient, accessible only by caregivers and doctors
router.post('/update', protect, authorizeRoles('caregiver', 'doctor'), updateVitals);

module.exports = router;
