const Medicine = require('../models/Medicine');
const User = require('../models/User');

// @desc     Get medicines for a specific patient
// @route    GET api/medicines/patient/:patientId
// @access   Private (Doctor/Caregiver)
exports.getPatientMedicines = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role === 'doctor' || (user.role === 'caregiver' && user.patientIds.includes(req.params.patientId))) {
            const medicines = await Medicine.find({ user: req.params.patientId }).sort({ date: -1 });
            return res.json(medicines);
        }
        res.status(403).json({ msg: 'Access denied' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get all medicines for logged-in user
// @route    GET api/medicines
// @access   Private
exports.getMyMedicines = async (req, res) => {
    try {
        const medicines = await Medicine.find({ user: req.user.id }).sort({ date: -1 });
        res.json(medicines);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get single medicine by ID
// @route    GET api/medicines/:id
// @access   Private
exports.getMedicineById = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) return res.status(404).json({ msg: 'Medicine not found' });

        if (medicine.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        res.json(medicine);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Medicine not found' });
        res.status(500).send('Server error');
    }
};

// @desc     Add a new medicine
// @route    POST api/medicines
// @access   Private
exports.addMedicine = async (req, res) => {
    try {
        const { name, dosage, time, frequency, daysOfWeek, startDate, user: targetUserId, notes, diagnosis } = req.body;
        if (!name || !time) return res.status(400).json({ msg: 'Name and time are required' });

        const requestingUser = await User.findById(req.user.id);
        let assignToUser = req.user.id;
        if (requestingUser.role === 'doctor' && targetUserId) {
            assignToUser = targetUserId;

            // Update patient diagnosis if provided by doctor
            if (diagnosis) {
                await User.findByIdAndUpdate(targetUserId, { diagnosis });
            }
        }

        const newMedicine = new Medicine({
            user: assignToUser,
            name,
            dosage: dosage || '',
            time,
            frequency: frequency || 'Daily',
            daysOfWeek: daysOfWeek || [],
            startDate: startDate || Date.now(),
            prescribedByRole: requestingUser.role,
            ...(requestingUser.role === 'doctor' && notes !== undefined ? { notes } : {})
        });

        const medicine = await newMedicine.save();
        res.status(201).json(medicine);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Update a medicine
// @route    PUT api/medicines/:id
// @access   Private
exports.updateMedicine = async (req, res) => {
    try {
        let medicine = await Medicine.findById(req.params.id);
        if (!medicine) return res.status(404).json({ msg: 'Medicine not found' });

        const requestingUser = await User.findById(req.user.id);
        
        // Security check: Only owner, doctor, or linked caregiver can modify
        const isOwner = medicine.user.toString() === req.user.id;
        const isDoctor = requestingUser.role === 'doctor';
        const isLinkedCaregiver = requestingUser.role === 'caregiver' && requestingUser.patientIds.includes(medicine.user.toString());

        if (!isOwner && !isDoctor && !isLinkedCaregiver) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const { name, dosage, time, frequency, daysOfWeek, startDate, status, notes } = req.body;
        const updateFields = {};
        if (name) updateFields.name = name;
        if (dosage !== undefined) updateFields.dosage = dosage;
        if (time) updateFields.time = time;
        if (frequency) updateFields.frequency = frequency;
        if (daysOfWeek !== undefined) updateFields.daysOfWeek = daysOfWeek;
        if (startDate) updateFields.startDate = startDate;
        if (status) updateFields.status = status;

        if (isDoctor && notes !== undefined) {
            updateFields.notes = notes;
        }

        medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        );
        res.json(medicine);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Delete a medicine
// @route    DELETE api/medicines/:id
// @access   Private
exports.deleteMedicine = async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) return res.status(404).json({ msg: 'Medicine not found' });

        const requestingUser = await User.findById(req.user.id);
        const isOwner = medicine.user.toString() === req.user.id;
        const isDoctor = requestingUser.role === 'doctor';
        const isLinkedCaregiver = requestingUser.role === 'caregiver' && requestingUser.patientIds.includes(medicine.user.toString());

        if (!isOwner && !isDoctor && !isLinkedCaregiver) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Patients can only delete medications they scheduled themselves
        if (requestingUser.role === 'patient' && medicine.prescribedByRole !== 'patient') {
            return res.status(403).json({ msg: 'Patients can only delete their own scheduled medications' });
        }

        await Medicine.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Medicine removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
