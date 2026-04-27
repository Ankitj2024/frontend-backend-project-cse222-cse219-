const express = require('express');
const router = express.Router();
const { getDoctors, createDoctor, updateDoctor, deleteDoctor, getDoctorStats, getAllUsers, deleteUser, approveDoctor } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

// All routes here require being an admin
router.use(protect);
router.use(adminOnly);

router.get('/doctors', getDoctors);
router.post('/doctors', createDoctor);
router.put('/doctors/:id', updateDoctor);
router.delete('/doctors/:id', deleteDoctor);
router.get('/doctors/:id/stats', getDoctorStats);
router.put('/doctors/:id/approve', approveDoctor);

// General User Management
router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);

module.exports = router;
