const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// BÜYÜ BURADA: İnsan Kaynaklarına SADECE Admin (Patron) Girebilir!
router.use(verifyToken, authorizeRoles('Admin'));

router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;