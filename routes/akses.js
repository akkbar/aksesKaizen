const express = require('express')
const router = express.Router()
const aksesController = require('../controllers/aksesController')
const isAuthenticated = require('../middlewares/authMiddleware')
const authorizeRoles = require('../middlewares/authorizeRoles')

router.get('/', isAuthenticated, aksesController.getHomePage)


router.get('/deviceStatus', isAuthenticated, aksesController.deviceStatus)
router.post('/setFingerprint', isAuthenticated, aksesController.setFingerprintPort)
router.post('/setRelay', isAuthenticated, aksesController.setRelayPort)
router.get('/detectDevice', isAuthenticated, aksesController.detectDevice)

router.get('/uAccess', isAuthenticated, aksesController.getAkses)
router.post('/uAccess', isAuthenticated, aksesController.getAksesAjax)
router.post('/getAccessDetail', isAuthenticated, aksesController.getAccessDetail)
router.post('/updateAccess', isAuthenticated, aksesController.updateAccess)


router.get('/addRFID', isAuthenticated, aksesController.addRFID)
router.post('/startEnrollRFID', isAuthenticated, aksesController.startEnrollRFID)
router.post('/submitEnrollRFID', isAuthenticated, aksesController.submitEnrollRFID)
router.get('/statusEnrollRFID', isAuthenticated, aksesController.statusEnrollRFID)


router.get('/addFingerprint', isAuthenticated, aksesController.addFingerprint)
router.post('/enrollFingerprint', isAuthenticated, aksesController.enrollFingerprint);


router.get('/accessLogs', isAuthenticated, aksesController.logAkses);
router.post('/accessLogs', isAuthenticated, aksesController.logAksesAjax);

module.exports = router
