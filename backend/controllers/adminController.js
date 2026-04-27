const bcrypt = require('bcryptjs');
const User = require('../models/User');

// @desc    Get all doctors
// @route   GET /api/admin/doctors
// @access  Private/Admin
exports.getDoctors = async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' }).select('-password');
        res.json(doctors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Create a doctor
// @route   POST /api/admin/doctors
// @access  Private/Admin
exports.createDoctor = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            name,
            email,
            password,
            role: 'doctor'
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.status(201).json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Update a doctor
// @route   PUT /api/admin/doctors/:id
// @access  Private/Admin
exports.updateDoctor = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        const user = await User.findOneAndUpdate(
            { _id: req.params.id, role: 'doctor' },
            { $set: updateData },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'Doctor not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Delete a doctor
// @route   DELETE /api/admin/doctors/:id
// @access  Private/Admin
exports.deleteDoctor = async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ _id: req.params.id, role: 'doctor' });

        if (!user) {
            return res.status(404).json({ msg: 'Doctor not found' });
        }

        res.json({ msg: 'Doctor removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Get stats for a specific doctor
// @route   GET /api/admin/doctors/:id/stats
// @access  Private/Admin
exports.getDoctorStats = async (req, res) => {
    try {
        const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' });
        if (!doctor) {
            return res.status(404).json({ msg: 'Doctor not found' });
        }

        // Find patients who have this doctor's name as their doctorName
        // Note: In this schema, patients store doctorName as a string. 
        // We could also search by name.
        const patients = await User.find({ doctorName: doctor.name, role: 'patient' }).select('name email age');

        res.json({
            doctor: {
                id: doctor._id,
                name: doctor.name,
                email: doctor.email
            },
            patientCount: patients.length,
            patients: patients
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Get all users (for Admin User Management)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Delete any user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        console.log(`[Admin] Attempting to delete user with ID: ${req.params.id}`);
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json({ msg: 'User removed successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc    Approve a doctor account
// @route   PUT /api/admin/doctors/:id/approve
// @access  Private/Admin
exports.approveDoctor = async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(
            { _id: req.params.id, role: 'doctor' },
            { $set: { isApproved: true } },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ msg: 'Doctor not found' });
        }

        res.json({ msg: 'Doctor approved successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
