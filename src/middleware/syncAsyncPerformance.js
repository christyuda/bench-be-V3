const AsyncPerformanceBenchmarkMongo = require('../models/mongo/AsyncPerformanceBenchmark');
const AsyncPerformanceBenchmarkMySQL = require('../models/mysql/AsyncPerformanceBenchmark');
const { checkDatabaseStatus } = require('../config/handlers');
const { ObjectId } = require('bson');

const isValidObjectId = (id) => {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

const syncAsyncPerformance = async () => {
    const status = await checkDatabaseStatus();

    if (status.mongoConnected && status.mysqlConnected) {
        console.log('Both databases are connected. Synchronizing data...');

        // Sync from MongoDB to MySQL
        const mongoBenchmarks = await AsyncPerformanceBenchmarkMongo.find({ isDeleted: false });
        for (const benchmark of mongoBenchmarks) {
            let mongoIdStr = benchmark._id.toString();
            const existingBenchmark = await AsyncPerformanceBenchmarkMySQL.findOne({ where: { mongoId: mongoIdStr } });

            if (!existingBenchmark) {
                await AsyncPerformanceBenchmarkMySQL.create({
                    mongoId: mongoIdStr,
                    testType: benchmark.testType,
                    testCode: benchmark.testCode,
                    testConfig: benchmark.testConfig,
                    results: benchmark.results,
                    averageAsyncExecution: benchmark.averageAsyncExecution,
                    totalAverageAsyncExecution: benchmark.totalAverageAsyncExecution,
                    timestamp: benchmark.timestamp,
                    javascriptType: benchmark.javascriptType,
                    createdAt: benchmark.createdAt,
                    updatedAt: benchmark.updatedAt
                });
                console.log(`AsyncPerformanceBenchmark ${mongoIdStr} added from MongoDB to MySQL`);
            } else if (new Date(benchmark.updatedAt) > new Date(existingBenchmark.updatedAt)) {
                await AsyncPerformanceBenchmarkMySQL.update({
                    testType: benchmark.testType,
                    testCode: benchmark.testCode,
                    testConfig: benchmark.testConfig,
                    results: benchmark.results,
                    averageAsyncExecution: benchmark.averageAsyncExecution,
                    totalAverageAsyncExecution: benchmark.totalAverageAsyncExecution,
                    timestamp: benchmark.timestamp,
                    javascriptType: benchmark.javascriptType,
                    updatedAt: new Date()
                }, { where: { mongoId: mongoIdStr } });
                console.log(`AsyncPerformanceBenchmark ${mongoIdStr} updated from MongoDB to MySQL`);
            }
        }

        // Sync from MySQL to MongoDB
        const mysqlBenchmarks = await AsyncPerformanceBenchmarkMySQL.findAll({ where: { isDeleted: false } });
        for (const benchmark of mysqlBenchmarks) {
            if (benchmark.mongoId && isValidObjectId(benchmark.mongoId)) {
                const existingBenchmark = await AsyncPerformanceBenchmarkMongo.findById(benchmark.mongoId);
                if (!existingBenchmark) {
                    const newBenchmark = new AsyncPerformanceBenchmarkMongo({
                        _id: benchmark.mongoId,
                        testType: benchmark.testType,
                        testCode: benchmark.testCode,
                        testConfig: benchmark.testConfig,
                        results: benchmark.results,
                        averageAsyncExecution: benchmark.averageAsyncExecution,
                        totalAverageAsyncExecution: benchmark.totalAverageAsyncExecution,
                        timestamp: benchmark.timestamp,
                        javascriptType: benchmark.javascriptType,
                        createdAt: benchmark.createdAt,
                        updatedAt: benchmark.updatedAt
                    });
                    await newBenchmark.save();
                    console.log(`AsyncPerformanceBenchmark ${benchmark.mongoId} added from MySQL to MongoDB`);
                } else if (new Date(benchmark.updatedAt) > new Date(existingBenchmark.updatedAt)) {
                    await AsyncPerformanceBenchmarkMongo.findByIdAndUpdate(benchmark.mongoId, {
                        testType: benchmark.testType,
                        testCode: benchmark.testCode,
                        testConfig: benchmark.testConfig,
                        results: benchmark.results,
                        averageAsyncExecution: benchmark.averageAsyncExecution,
                        totalAverageAsyncExecution: benchmark.totalAverageAsyncExecution,
                        timestamp: benchmark.timestamp,
                        javascriptType: benchmark.javascriptType,
                        updatedAt: new Date()
                    }, { new: true });
                    console.log(`AsyncPerformanceBenchmark ${benchmark.mongoId} updated from MySQL to MongoDB`);
                }
            }
        }
    } else {
        console.log('One or both databases are not connected. Skipping synchronization.');
    }
};

module.exports = { syncAsyncPerformance };
