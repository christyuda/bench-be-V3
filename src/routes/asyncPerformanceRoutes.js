const express = require('express');
const router = express.Router();
const mongoController = require('../controllers/mongo/asyncPerformanceController');
const mysqlController = require('../controllers/mysql/asyncPerformanceController');
const { checkDatabaseStatus } = require('../config/handlers');

const getController = async () => {
    const dbStatus = await checkDatabaseStatus();
    if (dbStatus.mongoConnected) {
        return mongoController; // Prefer MongoDB if connected
    } else if (dbStatus.mysqlConnected) {
        return mysqlController; // Fallback to MySQL if MongoDB is not available
    }
    throw new Error('No database connection available');
};

router.post('/create', async (req, res) => {
    try {
        const controller = await getController();
        await controller.startBenchmark(req, res);
    } catch (error) {
        console.error('Error in /create route:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;