const mongoose = require('mongoose');

// Vitals Schema: Defines the structure for a user's health vitals in MongoDB
const VitalsSchema = new mongoose.Schema({
    // Reference to the user this vitals record belongs to
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    // Health metrics
    heartRate: { type: Number },
    bloodPressure: {
        systolic: { type: Number },
        diastolic: { type: Number }
    },
    weight: { type: Number },
    // Timestamp for when the vitals were recorded
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('vitals', VitalsSchema);
