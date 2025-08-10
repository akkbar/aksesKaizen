const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const isAuthenticated = require('../middlewares/authMiddleware');

router.get('/login', authController.getLoginPage);
router.post('/login', authController.loginUser);

router.get('/logout', authController.logoutUser);

router.get('/register', authController.getRegisterPage);
router.post('/register', authController.registerUser);

router.get('/errorLogs', isAuthenticated, authController.errorLogs);
module.exports = router;
