const mainDb = require('../models/mainDb');
const bcrypt = require('bcrypt');
require('dotenv').config();
const axios = require('axios')

exports.getLoginPage = (req, res) => {
    res.render('login', { errorMessage: null });
};

exports.loginUser = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await mainDb('users').where({ 'username': username, 'isactive': 1 }).first();
        if (!user) {
            return res.json({ success: false, message: 'Invalid email'});
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.json({ success: false, message: 'Invalid email or password'});
        }

        req.session.user = {
            id: user.id,
            name: user.fullname,
            username: user.username,
            userrole: user.user_role,
            sidemenu: ''
        };
        return res.json({ success: true});

    } catch (error) {
        console.error('Error during login:', error);
        return res.json({ success: false, message: 'Server error, please try again later'});
    }
};

exports.logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
        }
        res.redirect('/login');
    });
};

exports.getRegisterPage = (req, res) => {
    res.render('register', { errorMessage: null });
};

exports.registerUser = async (req, res) => {
    const { fullname, username, password, repassword } = req.body;
    const errors = {};

    const isValidPassword = (password) =>
        password.length >= 8 && /(?=.*[A-Z])(?=.*\W)(?=.*\d)/.test(password);

    if (!fullname) {
        errors.fullname = 'Full Name is required.';
    }
    if (!username) {
        errors.username = 'Username is required.';
    }
    // if (!email) {
    //     errors.email = 'Email is required.';
    // } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    //     errors.email = 'Invalid email format.';
    // }
    if (!password) {
        errors.password = 'Password is required.';
    } else if (!isValidPassword(password)) {
        errors.password =
            'Password must be at least 8 characters, include 1 uppercase letter, 1 number, and 1 symbol.';
    }
    if (password !== repassword) {
        errors.repassword = 'Passwords do not match.';
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }
    try {
        // Check username into the database
        const user = await mainDb('users').where({ username }).first();
        if (user) {
            errors.username = 'Username already exists.';
            return res.json({ success: false, errors});
        }
        const hashedPassword = await bcrypt.hash(password, 10);

         // Insert new user into the database
        await mainDb('users').insert({
            fullname,
            username,
            password: hashedPassword,
        });
        return res.json({ success: true });
    }catch (error) {
        console.error('Error registering user:', error);
        res.render('register', { message: 'Server error' });
    }
};

exports.errorLogs = async (req, res) => {
    try {
        const header = {pageTitle: 'Dashboard', user: req.session.user}
        const errorLogs = await ErrorLog.find().sort({ timestamp: -1 });
        const data = {
            errorLogs: errorLogs
        }
        res.render('errorlogs', {header: header, data: data})
    } catch (err) {
        res.status(500).send('Error fetching error logs');
    }
}