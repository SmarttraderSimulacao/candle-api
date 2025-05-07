const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Rotas protegidas (requerem autenticação)
router.get('/user/participations', protect, userController.getUserParticipations);

module.exports = router;