const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

// Rotas protegidas por autenticação de administrador
router.use(isAdmin);

// Rotas de usuários
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id/verify-document', adminController.verifyUserDocument);
router.put('/users/:id/add-balance', adminController.addUserBalance);

// Rotas de salas
router.get('/rooms', adminController.getAllRooms);
router.get('/rooms/:id', adminController.getRoomDetails);
router.post('/rooms', adminController.createRoom);
router.put('/rooms/:id/status', adminController.updateRoomStatus);
router.post('/rooms/:id/process-payments', adminController.processRoomPayments);

// Novas rotas para relatório de pagamentos
router.get('/rooms/:id/winners', adminController.getRoomWinners);
router.put('/rooms/:id/update-payment-status', adminController.updatePaymentStatus);

// Rotas de relatórios
router.get('/reports/competitions', adminController.getCompetitionsReport);

// Estatísticas
router.get('/stats', adminController.getAdminStats);

module.exports = router;
