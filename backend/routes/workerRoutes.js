const express = require('express');
const router = express.Router();

const { createWorker, listWorkersForAssignment } = require('../controllers/workerController');

router.post('/api/workers', createWorker);
router.get('/api/workers', listWorkersForAssignment);

module.exports = router;

