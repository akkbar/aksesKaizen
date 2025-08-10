const express = require('express')
const router = express.Router()
const userController = require('../controllers/userController')
const isAuthenticated = require('../middlewares/authMiddleware')
const authorizeRoles = require('../middlewares/authorizeRoles')

router.get('/', isAuthenticated, authorizeRoles('Admin', 'Manager'), userController.userList)
router.post('/', isAuthenticated, authorizeRoles('Admin', 'Manager'), userController.userListAjax)
router.post('/create', isAuthenticated, authorizeRoles('Admin', 'Manager'), userController.createProfile)
router.post('/get', isAuthenticated, authorizeRoles('Admin', 'Manager'), userController.getProfile)
router.post('/updateUser', isAuthenticated, authorizeRoles('Admin', 'Manager'), userController.updateUser)
router.post('/removeUser', isAuthenticated, authorizeRoles('Admin', 'Manager'), userController.removeUser)


router.get('/my', isAuthenticated, userController.myUsers)
router.post('/changepass', isAuthenticated, userController.changePass)
router.post('/updateProfile', isAuthenticated, userController.updateProfile)

router.get('/sidemenu', isAuthenticated, userController.sidemenu)

module.exports = router
