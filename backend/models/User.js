const mongoose = require('mongoose');

// User Schema: Defines the structure of the User document in MongoDB
const UserSchema = new mongoose.Schema({
    // Basic user information
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    // User role determining access permissions and capabilities
    role: { type: String, enum: ['patient', 'caregiver', 'doctor', 'admin'], default: 'patient' },
    // Optional medical and demographic info
    age: { type: Number },
    doctorName: { type: String },
    specialty: { type: String },
    diagnosis: { type: String },
    // Admin approval flag for doctors
    isApproved: { type: Boolean, default: false },
    // Relationships: A patient can have a caregiver, and caregivers/doctors can have multiple patients
    caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    patientIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
    // Array of notifications/alerts sent to the user
    notifications: [{
        message: { type: String, required: true },
        type: { type: String, enum: ['message', 'medicine'], default: 'message' },
        medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'medicine' },
        date: { type: Date, default: Date.now },
        read: { type: Boolean, default: false }
    }],
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('user', UserSchema);
