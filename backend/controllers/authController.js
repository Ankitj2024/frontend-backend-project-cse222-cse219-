const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc     Register user
// @route    POST api/auth/register
// @access   Public
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, age, doctorName, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all required fields' });
        }

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Validate role
        const validRoles = ['patient', 'caregiver', 'doctor', 'admin'];
        const userRole = role && validRoles.includes(role) ? role : 'patient';

        user = new User({
            name,
            email,
            password,
            role: userRole,
            age,
            doctorName
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        res.status(201).json({
            token: generateToken(user._id, user.role),
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                age: user.age,
                doctorName: user.doctorName
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Authenticate user & get token
// @route    POST api/auth/login
// @access   Public
exports.loginUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        const foundUser = await User.findOne({ email });
        if (!foundUser) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Enforce role check if provided
        if (role && foundUser.role !== role) {
            return res.status(403).json({ msg: `Access denied. This account is registered as a ${foundUser.role}, not a ${role}.` });
        }

        const isMatch = await bcrypt.compare(password, foundUser.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        res.json({
            _id: foundUser._id,
            name: foundUser.name,
            email: foundUser.email,
            role: foundUser.role,
            age: foundUser.age,
            doctorName: foundUser.doctorName,
            token: generateToken(foundUser._id, foundUser.role),
            // backward compatibility for existing code expecting res.user
            user: {
                id: foundUser._id,
                name: foundUser.name,
                email: foundUser.email,
                role: foundUser.role,
                age: foundUser.age,
                doctorName: foundUser.doctorName
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get logged in user profile
// @route    GET api/auth/me
// @access   Private
exports.getMe = async (req, res) => {
    try {
        const foundUser = await User.findById(req.user.id).select('-password');

        if (!foundUser) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json(foundUser);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// @desc     Get all doctors (public)
// @route    GET api/auth/doctors
// @access   Public
exports.getDoctorsPublic = async (req, res) => {
    try {
        const doctors = await User.find({ role: 'doctor' }).select('name _id');
        res.json(doctors);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};
