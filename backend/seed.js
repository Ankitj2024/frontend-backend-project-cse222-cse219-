/**
 * MedRemind Sample Data Seed Script
 * Creates 5 Doctors, 5 Caregivers, 10 Patients with medications,
 * medication logs (history/streaks), and vitals.
 * Does NOT touch the existing admin account.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Medicine = require('./models/Medicine');
const Log = require('./models/Log');
const Vitals = require('./models/Vitals');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/medremind';

// ─── DATA DEFINITIONS ────────────────────────────────────────

const doctors = [
  { name: 'Dr. Aarav Sharma',   email: 'dr.aarav@medremind.com',   age: 45, specialty: 'Cardiologist' },
  { name: 'Dr. Priya Patel',    email: 'dr.priya@medremind.com',   age: 38, specialty: 'Neurologist' },
  { name: 'Dr. Rohan Mehta',    email: 'dr.rohan@medremind.com',   age: 52, specialty: 'Orthopedic Surgeon' },
  { name: 'Dr. Sneha Gupta',    email: 'dr.sneha@medremind.com',   age: 41, specialty: 'Dermatologist' },
  { name: 'Dr. Vikram Singh',   email: 'dr.vikram@medremind.com',  age: 48, specialty: 'Pulmonologist' },
];

const caregivers = [
  { name: 'Anita Verma',    email: 'anita.cg@medremind.com',   age: 32 },
  { name: 'Rajesh Kumar',   email: 'rajesh.cg@medremind.com',  age: 28 },
  { name: 'Meena Devi',     email: 'meena.cg@medremind.com',   age: 45 },
  { name: 'Suresh Yadav',   email: 'suresh.cg@medremind.com',  age: 36 },
  { name: 'Kavita Joshi',   email: 'kavita.cg@medremind.com',  age: 29 },
];

const patients = [
  { name: 'Amit Chauhan',     email: 'amit.p@medremind.com',     age: 65, caregiverIdx: 0 },
  { name: 'Neha Agarwal',     email: 'neha.p@medremind.com',     age: 34, caregiverIdx: 0 },
  { name: 'Ravi Tiwari',      email: 'ravi.p@medremind.com',     age: 72, caregiverIdx: 1 },
  { name: 'Sunita Mishra',    email: 'sunita.p@medremind.com',   age: 55, caregiverIdx: 1 },
  { name: 'Deepak Pandey',    email: 'deepak.p@medremind.com',   age: 28, caregiverIdx: 2 },
  { name: 'Pooja Rawat',      email: 'pooja.p@medremind.com',    age: 40, caregiverIdx: 2 },
  { name: 'Ramesh Sharma',    email: 'ramesh.p@medremind.com',   age: 50, caregiverIdx: 3 },
  { name: 'Geeta Verma',      email: 'geeta.p@medremind.com',    age: 60, caregiverIdx: 3 },
  { name: 'Sanjay Gupta',     email: 'sanjay.p@medremind.com',   age: 45, caregiverIdx: 4 },
  { name: 'Kiran Singh',      email: 'kiran.p@medremind.com',    age: 58, caregiverIdx: 4 },
];

// Different medications for variety
const medicationSets = [
  // Patient 0 - Cardiac
  [
    { name: 'Atorvastatin',  dosage: '20mg',  time: '08:00', frequency: 'Daily', notes: 'Take with food' },
    { name: 'Aspirin',       dosage: '75mg',  time: '09:00', frequency: 'Daily', notes: 'After breakfast' },
    { name: 'Metoprolol',    dosage: '50mg',  time: '20:00', frequency: 'Daily', notes: 'Before bed' },
  ],
  // Patient 1 - Neurological
  [
    { name: 'Gabapentin',    dosage: '300mg', time: '07:30', frequency: 'Daily', notes: 'Morning dose' },
    { name: 'Amitriptyline', dosage: '25mg',  time: '21:00', frequency: 'Daily', notes: 'At night' },
  ],
  // Patient 2 - Cardiac + Diabetes
  [
    { name: 'Metformin',     dosage: '500mg', time: '08:00', frequency: 'Daily', notes: 'With breakfast' },
    { name: 'Losartan',      dosage: '50mg',  time: '09:00', frequency: 'Daily', notes: 'For BP' },
    { name: 'Insulin',       dosage: '10 units', time: '19:00', frequency: 'Daily', notes: 'Before dinner' },
  ],
  // Patient 3 - Orthopedic
  [
    { name: 'Calcium + D3',  dosage: '500mg', time: '10:00', frequency: 'Daily', notes: 'With milk' },
    { name: 'Ibuprofen',     dosage: '400mg', time: '14:00', frequency: 'Weekly', daysOfWeek: [1, 3, 5], notes: 'For pain relief' },
  ],
  // Patient 4 - Dermatological
  [
    { name: 'Cetirizine',    dosage: '10mg',  time: '22:00', frequency: 'Daily', notes: 'Antihistamine' },
    { name: 'Vitamin E',     dosage: '400IU', time: '08:30', frequency: 'Daily', notes: 'Skin health' },
  ],
  // Patient 5 - Pulmonary
  [
    { name: 'Montelukast',   dosage: '10mg',  time: '21:00', frequency: 'Daily', notes: 'Asthma management' },
    { name: 'Salbutamol',    dosage: '2 puffs', time: '07:00', frequency: 'Daily', notes: 'Morning inhaler' },
    { name: 'Budesonide',    dosage: '200mcg',  time: '19:30', frequency: 'Daily', notes: 'Evening inhaler' },
  ],
  // Patient 6 - Neurological
  [
    { name: 'Levodopa',      dosage: '250mg', time: '08:00', frequency: 'Daily', notes: 'Parkinsons' },
    { name: 'Trihexyphenidyl', dosage: '2mg', time: '14:00', frequency: 'Daily', notes: 'Afternoon' },
  ],
  // Patient 7 - Orthopedic
  [
    { name: 'Diclofenac',    dosage: '50mg',  time: '09:00', frequency: 'Daily', notes: 'Anti-inflammatory' },
    { name: 'Pantoprazole',  dosage: '40mg',  time: '07:30', frequency: 'Daily', notes: 'Stomach protection' },
    { name: 'Glucosamine',   dosage: '1500mg', time: '12:00', frequency: 'Daily', notes: 'Joint health' },
  ],
  // Patient 8 - Dermatological
  [
    { name: 'Doxycycline',   dosage: '100mg', time: '10:00', frequency: 'Daily', notes: 'Acne treatment' },
    { name: 'Zinc',          dosage: '50mg',  time: '20:00', frequency: 'Daily', notes: 'Skin repair' },
  ],
  // Patient 9 - Pulmonary
  [
    { name: 'Theophylline',  dosage: '300mg', time: '08:00', frequency: 'Daily', notes: 'Bronchodilator' },
    { name: 'Azithromycin',  dosage: '500mg', time: '12:00', frequency: 'Weekly', daysOfWeek: [1, 4], notes: 'Prophylactic' },
    { name: 'Prednisone',    dosage: '5mg',   time: '09:00', frequency: 'Every Other Day', notes: 'Tapering dose' },
  ],
];

// Vitals for each patient (varying from normal to abnormal for risk diversity)
const vitalsSets = [
  { heartRate: 92,  systolic: 150, diastolic: 95 },   // Patient 0 - High BP (High risk)
  { heartRate: 72,  systolic: 118, diastolic: 76 },   // Patient 1 - Normal
  { heartRate: 105, systolic: 145, diastolic: 88 },   // Patient 2 - High HR + borderline BP
  { heartRate: 78,  systolic: 125, diastolic: 80 },   // Patient 3 - Normal
  { heartRate: 68,  systolic: 110, diastolic: 70 },   // Patient 4 - Normal
  { heartRate: 88,  systolic: 130, diastolic: 85 },   // Patient 5 - Normal
  { heartRate: 55,  systolic: 138, diastolic: 82 },   // Patient 6 - Low HR (bradycardia)
  { heartRate: 82,  systolic: 122, diastolic: 78 },   // Patient 7 - Normal
  { heartRate: 75,  systolic: 115, diastolic: 72 },   // Patient 8 - Normal
  { heartRate: 98,  systolic: 142, diastolic: 92 },   // Patient 9 - High BP
];

// ─── SEED FUNCTION ───────────────────────────────────────────

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clean up old seed data (but NOT admin)
    const allEmails = [
      ...doctors.map(d => d.email),
      ...caregivers.map(c => c.email),
      ...patients.map(p => p.email),
    ];
    const existingUsers = await User.find({ email: { $in: allEmails } });
    const existingIds = existingUsers.map(u => u._id);

    if (existingIds.length > 0) {
      await Medicine.deleteMany({ user: { $in: existingIds } });
      await Log.deleteMany({ user: { $in: existingIds } });
      await Vitals.deleteMany({ user: { $in: existingIds } });
      await User.deleteMany({ _id: { $in: existingIds } });
      console.log(`🧹 Cleaned up ${existingIds.length} existing seed users and their data`);
    }

    const hashedPassword = await bcrypt.hash('password123', 10);

    // ── Create Doctors ───────────────────────────────────
    const createdDoctors = [];
    for (const doc of doctors) {
      const user = await User.create({
        name: doc.name,
        email: doc.email,
        password: hashedPassword,
        role: 'doctor',
        age: doc.age,
        specialty: doc.specialty,
        isApproved: true, // Seeded doctors are approved
      });
      createdDoctors.push(user);
      console.log(`👨‍⚕️ Created doctor: ${doc.name} (${doc.specialty})`);
    }

    // ── Create Caregivers ────────────────────────────────
    const createdCaregivers = [];
    for (const cg of caregivers) {
      const user = await User.create({
        name: cg.name,
        email: cg.email,
        password: hashedPassword,
        role: 'caregiver',
        age: cg.age,
      });
      createdCaregivers.push(user);
      console.log(`🧑‍🤝‍🧑 Created caregiver: ${cg.name} (age ${cg.age})`);
    }

    // ── Create Patients ──────────────────────────────────
    const createdPatients = [];
    for (let i = 0; i < patients.length; i++) {
      const pat = patients[i];
      const caregiver = createdCaregivers[pat.caregiverIdx];
      const doctor = createdDoctors[i % createdDoctors.length]; // Distribute 2 patients per doctor

      const user = await User.create({
        name: pat.name,
        email: pat.email,
        password: hashedPassword,
        role: 'patient',
        age: pat.age,
        caregiverId: caregiver._id,
        doctorName: doctor.name, // Link to doctor
      });
      createdPatients.push(user);

      // Link patient to caregiver's patientIds
      await User.findByIdAndUpdate(caregiver._id, {
        $addToSet: { patientIds: user._id }
      });

      // Link patient to doctor's patientIds
      await User.findByIdAndUpdate(doctor._id, {
        $addToSet: { patientIds: user._id }
      });

      console.log(`🧑 Created patient: ${pat.name} (age ${pat.age}) → CG: ${caregiver.name}, Doc: ${doctor.name}`);
    }

    // ── Create Medications ───────────────────────────────
    const allMedicineIds = []; // allMedicineIds[patientIdx] = [medId, ...]
    for (let i = 0; i < createdPatients.length; i++) {
      const patient = createdPatients[i];
      const meds = medicationSets[i];
      const medIds = [];

      for (const med of meds) {
        const medicine = await Medicine.create({
          user: patient._id,
          name: med.name,
          dosage: med.dosage,
          time: med.time,
          frequency: med.frequency || 'Daily',
          daysOfWeek: med.daysOfWeek || [],
          notes: med.notes || '',
          status: 'active',
          prescribedByRole: 'doctor',
        });
        medIds.push(medicine._id);
      }
      allMedicineIds.push(medIds);
      console.log(`💊 Added ${meds.length} medications for ${patient.name}`);
    }

    // ── Create Medication Logs (History & Streaks) ───────
    console.log('\n📋 Creating medication history...');
    const now = new Date();

    for (let i = 0; i < createdPatients.length; i++) {
      const patient = createdPatients[i];
      const medIds = allMedicineIds[i];
      let logCount = 0;

      // Create logs for the past 14 days
      for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
        const logDate = new Date(now);
        logDate.setDate(logDate.getDate() - dayOffset);
        logDate.setHours(8, 0, 0, 0);

        for (const medId of medIds) {
          // Different adherence patterns per patient for variety
          let status = 'taken';

          if (i === 0) {
            // Patient 0: Good adherence (90%) - streak of 10+ days
            if (dayOffset === 12 || dayOffset === 7) status = 'skipped';
          } else if (i === 1) {
            // Patient 1: Excellent adherence (100%) - perfect streak
            status = 'taken';
          } else if (i === 2) {
            // Patient 2: Poor adherence (40%) - high risk
            if (dayOffset % 2 === 0 || dayOffset === 3 || dayOffset === 5) status = 'skipped';
          } else if (i === 3) {
            // Patient 3: Moderate adherence (70%)
            if (dayOffset === 1 || dayOffset === 4 || dayOffset === 9 || dayOffset === 11) status = 'skipped';
          } else if (i === 4) {
            // Patient 4: Great adherence (95%)
            if (dayOffset === 6) status = 'skipped';
          } else if (i === 5) {
            // Patient 5: Moderate (65%)
            if (dayOffset % 3 === 0 || dayOffset === 2) status = 'skipped';
          } else if (i === 6) {
            // Patient 6: Very poor (35%) - highest risk
            if (dayOffset % 3 !== 0) status = 'skipped';
          } else if (i === 7) {
            // Patient 7: Good (85%)
            if (dayOffset === 3 || dayOffset === 10) status = 'skipped';
          } else if (i === 8) {
            // Patient 8: Perfect recent, bad earlier
            if (dayOffset > 8) status = 'skipped';
          } else if (i === 9) {
            // Patient 9: Declining - missed recent days
            if (dayOffset < 4) status = 'skipped';
          }

          await Log.create({
            user: patient._id,
            medicine: medId,
            status,
            date: logDate,
          });
          logCount++;
        }
      }
      console.log(`   📝 ${patient.name}: ${logCount} log entries (14 days)`);
    }

    // ── Create Vitals ────────────────────────────────────
    console.log('\n❤️ Creating vitals records...');
    for (let i = 0; i < createdPatients.length; i++) {
      const patient = createdPatients[i];
      const v = vitalsSets[i];

      // Create a few vitals entries over the past week for each patient
      for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 2) {
        const vitalDate = new Date(now);
        vitalDate.setDate(vitalDate.getDate() - dayOffset);

        // Add slight variation each day
        const hrVariation = Math.floor(Math.random() * 7) - 3;
        const sysVariation = Math.floor(Math.random() * 9) - 4;
        const diaVariation = Math.floor(Math.random() * 5) - 2;

        await Vitals.create({
          user: patient._id,
          heartRate: v.heartRate + hrVariation,
          bloodPressure: {
            systolic: v.systolic + sysVariation,
            diastolic: v.diastolic + diaVariation,
          },
          weight: 55 + Math.floor(Math.random() * 35),
          date: vitalDate,
        });
      }
      console.log(`   💓 ${patient.name}: HR ${v.heartRate}, BP ${v.systolic}/${v.diastolic}`);
    }

    // ── Summary ──────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('✅ SEED COMPLETE!');
    console.log('═'.repeat(60));
    console.log(`   Doctors:     ${createdDoctors.length}`);
    console.log(`   Caregivers:  ${createdCaregivers.length}`);
    console.log(`   Patients:    ${createdPatients.length}`);
    console.log(`   Password:    password123 (for ALL accounts)`);
    console.log('═'.repeat(60));

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');

  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

seed();
