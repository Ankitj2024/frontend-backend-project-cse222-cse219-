const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    name: { type: String, required: true },
    dosage: { type: String },
    time: { type: String, required: true },
    frequency: { type: String },
    // For 'Weekly': array of day numbers (0=Sun, 1=Mon, ... 6=Sat)
    daysOfWeek: { type: [Number], default: [] },
    // For 'Every Other Day': the reference start date to calculate alternation
    startDate: { type: Date, default: Date.now },
    notes: { type: String },
    status: { type: String, enum: ['active', 'on hold', 'completed'], default: 'active' },
    prescribedByRole: { type: String, enum: ['doctor', 'patient', 'caregiver'], default: 'patient' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('medicine', MedicineSchema);
