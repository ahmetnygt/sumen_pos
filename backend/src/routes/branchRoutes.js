const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { verifyToken, authorizeRoles, requireCompany } = require('../middlewares/authMiddleware');

router.use(verifyToken, authorizeRoles('Admin'), requireCompany);
router.get('/', branchController.listBranches);
router.post('/', branchController.createBranch);
router.put('/:id', branchController.updateBranch);
router.delete('/:id', branchController.deleteBranch);

module.exports = router;
