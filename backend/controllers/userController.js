const User = require('../models/User');

// @desc     Get all patients (for Doctors)
//           This function retrieves all registered users with the 'patient' role from the database. It is strictly accessible only to doctors.
// @route    GET api/users/patients
// @access   Private (Doctor only)
exports.getPatients = async (req, res) => {
    try {
        // Fetch the requesting user from the database
        const user = await User.findById(req.user.id);
        // Ensure only users with the 'doctor' role can access this
        if (user.role !== 'doctor') return res.status(403).json({ msg: 'Access denied' });

        // Retrieve all users with the 'patient' role, excluding their password fields
        const patients = await User.find({ role: 'patient' }).select('-password');
        res.json(patients);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get patients linked to caregiver
//           This function fetches the details of all patients who are currently linked to the requesting caregiver.
// @route    GET api/users/my-patients
// @access   Private (Caregiver only)
exports.getMyPatients = async (req, res) => {
    try {
        // Find the user and populate their associated patients' details (excluding passwords)
        const user = await User.findById(req.user.id).populate('patientIds', '-password');
        // Ensure only users with the 'caregiver' role can access their linked patients
        if (user.role !== 'caregiver') return res.status(403).json({ msg: 'Access denied' });

        // Return the populated list of linked patients
        res.json(user.patientIds);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Link a patient to caregiver
//           This function allows a caregiver or doctor to link a patient to their account using the patient's email. It can also update the patient's diagnosis.
// @route    POST api/users/link-patient
// @access   Private (Caregiver only)
exports.linkPatient = async (req, res) => {
    try {
        const { email, diagnosis } = req.body;
        // Verify the user attempting to link the patient is a caregiver or doctor
        const user = await User.findById(req.user.id);
        if (user.role !== 'caregiver' && user.role !== 'doctor') return res.status(403).json({ msg: 'Access denied' });

        // Find the target patient by their email address
        const patient = await User.findOne({ email, role: 'patient' });
        if (!patient) return res.status(404).json({ msg: 'Patient not found' });

        // Update diagnosis if provided
        if (diagnosis) {
            patient.diagnosis = diagnosis.trim();
            await patient.save();
        }

        // Link logic for caregivers and doctors
        if (user.role === 'caregiver' || user.role === 'doctor') {
            if (!user.patientIds.includes(patient._id)) {
                user.patientIds.push(patient._id);
                await user.save();
            }
        }

        res.json({ msg: 'Patient linked successfully', patient });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Update user profile
//           This function processes profile updates (like name, age, specialty) for the currently logged-in user.
// @route    PUT api/users/profile
// @access   Private
exports.updateProfile = async (req, res) => {
    try {
        const { name, age, specialty } = req.body;
        // Construct an object with only the fields provided in the request
        const updateFields = {};
        if (name) updateFields.name = name.trim();
        if (age) updateFields.age = parseInt(age);
        if (specialty) updateFields.specialty = specialty.trim();

        // Update the user document and return the updated version, excluding the password
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateFields },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get user profile
//           This function returns the full profile information (excluding the password) for the authenticated user making the request.
// @route    GET api/users/profile
// @access   Private
exports.getProfile = async (req, res) => {
    try {
        // Retrieve the profile of the currently logged-in user without their password
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Send alert to patient
//           This function allows a caregiver or doctor to push a notification/alert to a specific patient's account.
// @route    POST api/users/alert
// @access   Private (Caregiver/Doctor)
exports.sendAlert = async (req, res) => {
    try {
        const { patientId, message, type, medicineId } = req.body;

        // Verify the user sending the alert is a caregiver or doctor
        const sender = await User.findById(req.user.id);
        if (sender.role !== 'caregiver' && sender.role !== 'doctor') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        // Find the patient who is intended to receive the alert
        const patient = await User.findById(patientId);
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ msg: 'Patient not found' });
        }

        patient.notifications.push({
            message: message || (type === 'medicine' ? `Time to take your medication.` : `Reminder: Your ${sender.role} ${sender.name} has requested you to check your medication schedule.`),
            type: type || 'message',
            medicineId: medicineId || null,
            read: false,
            date: new Date()
        });

        await patient.save();
        res.json({ msg: 'Alert sent successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get my alerts
//           This function fetches all unread notifications/alerts for the currently logged-in patient.
// @route    GET api/users/alerts
// @access   Private (Patient)
exports.getAlerts = async (req, res) => {
    try {
        // Only patients can fetch alerts
        const user = await User.findById(req.user.id);
        if (user.role !== 'patient') return res.status(403).json({ msg: 'Access denied' });

        // Filter and return only the unread notifications
        res.json(user.notifications.filter(n => !n.read));
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Dismiss alert
//           This function marks a specific alert as "read" so it no longer appears as unread for the patient.
// @route    PUT api/users/alerts/:id/dismiss
// @access   Private (Patient)
exports.dismissAlert = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'patient') return res.status(403).json({ msg: 'Access denied' });

        // Find the specific notification by its ID
        const notification = user.notifications.id(req.params.id);
        if (notification) {
            // Mark the notification as read and save the user document
            notification.read = true;
            await user.save();
        }
        res.json({ msg: 'Alert dismissed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
// @desc     Unlink a patient from caregiver/doctor
//           This function removes a patient's ID from the caregiver/doctor's patientIds array and clears the associated metadata.
// @route    POST api/users/unlink-patient
// @access   Private (Caregiver/Doctor)
exports.unlinkPatient = async (req, res) => {
    try {
        const { patientId } = req.body;
        const user = await User.findById(req.user.id);
        
        if (user.role !== 'caregiver' && user.role !== 'doctor') {
            return res.status(403).json({ msg: 'Access denied' });
        }

        // Remove patient from user's list
        user.patientIds = user.patientIds.filter(id => id.toString() !== patientId);
        await user.save();

        // Optional: Clear doctorName on patient if unlinked by doctor
        if (user.role === 'doctor') {
            await User.findByIdAndUpdate(patientId, { $unset: { doctorName: "" } });
        }

        res.json({ msg: 'Patient unlinked successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
