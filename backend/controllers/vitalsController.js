const Vitals = require('../models/Vitals');

// @desc     Get all vitals for logged in user
//           This function retrieves the entire history of vitals for the currently logged-in user, sorted by the most recent date.
// @route    GET api/vitals
// @access   Private
exports.getMyVitals = async (req, res) => {
    try {
        // Find all vitals records associated with the logged-in user, sorted by date descending (newest first)
        const vitals = await Vitals.find({ user: req.user.id }).sort({ date: -1 });
        res.json(vitals);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Add new vitals entry
//           This function allows the user to record a new set of vital signs (heart rate, blood pressure, weight) linked to their account.
// @route    POST api/vitals
// @access   Private
exports.addVitals = async (req, res) => {
    try {
        // Extract vital signs from the request body
        const { heartRate, bloodPressure, weight } = req.body;
        // Create a new vitals document linking to the currently logged-in user
        const newVitals = new Vitals({
            user: req.user.id,
            heartRate,
            bloodPressure,
            weight
        });
        const vitals = await newVitals.save();
        res.json(vitals);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get vitals for a specific user
//           This function fetches up to the 10 most recent vitals records for a specified user, intended for caregivers or doctors.
// @route    GET api/vitals/stats/:userId
// @access   Private
exports.getPatientVitals = async (req, res) => {
    try {
        // Fetch up to 10 of the most recent vitals records for a specific user (patient)
        const vitals = await Vitals.find({ user: req.params.userId }).sort({ date: -1 }).limit(10);
        res.json(vitals);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Update vitals for a specific user (Caregiver only)
//           This function allows a caregiver to update an existing patient's most recent vitals record, or create a new one if none exists.
// @route    POST api/vitals/update
// @access   Private (Caregiver)
exports.updateVitals = async (req, res) => {
    try {
        const { userId, heartRate, systolic, diastolic } = req.body;
        // Find the most recent vitals record for the specified user
        let vitals = await Vitals.findOne({ user: userId }).sort({ date: -1 });

        if (vitals) {
            // Update fields only if they are provided in the request
            if (heartRate !== undefined) vitals.heartRate = heartRate;
            if (systolic || diastolic) {
                vitals.bloodPressure = { 
                    systolic: systolic || vitals.bloodPressure?.systolic, 
                    diastolic: diastolic || vitals.bloodPressure?.diastolic 
                };
            }
            vitals.date = Date.now();
            await vitals.save();
        } else {
            vitals = new Vitals({
                user: userId,
                heartRate,
                bloodPressure: { systolic, diastolic }
            });
            await vitals.save();
        }
        res.json(vitals);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
