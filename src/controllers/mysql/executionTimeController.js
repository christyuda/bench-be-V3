// src/controllers/mysql/executionTimeController.js
const ExecutionTime = require('../../models/mysql/ExecutionTime');
const { performance } = require('perf_hooks');
const escomplex = require('escomplex');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const si = require('systeminformation');

exports.startBenchmark = async (req, res) => {
    const { testType, testCodes, testConfig, javascriptType, mongoId } = req.body;

    if (!testType || !testCodes || !testConfig || !javascriptType) {
        return res.status(400).json({ success: false, error: "Please provide all required fields." });
    }

    try {
        const results = testCodes.map((code, index) => {
            let iterationsResults = [];
            let complexityReport = escomplex.analyse(code);
            let complexitySummary = {
                cyclomatic: complexityReport.aggregate.cyclomatic,
                sloc: complexityReport.aggregate.sloc,
                halstead: complexityReport.aggregate.halstead,
                maintainability: complexityReport.aggregate.maintainability
            };
            for (let i = 0; i < testConfig.iterations; i++) {
                const startTime = performance.now();
                eval(code);
                const endTime = performance.now();
                const executionTime = endTime - startTime;
                iterationsResults.push({
                    iteration: i + 1,
                    executionTime: `${executionTime.toFixed(2)} ms`
                });
            }
            const averageExecutionTime = iterationsResults.reduce((acc, curr) => acc + parseFloat(curr.executionTime), 0) / testConfig.iterations;
            return {
                testCodeNumber: index + 1,
                testCode: code,
                iterationsResults: iterationsResults,
                averageExecutionTime: `${averageExecutionTime.toFixed(2)} ms`,
                complexity: complexitySummary
            };
        });

        const overallAverage = results.reduce((acc, curr) => acc + parseFloat(curr.averageExecutionTime), 0) / results.length;

        const benchmark = await ExecutionTime.create({
            mongoId, // Optional MongoDB ID
            javascriptType,
            testType,
            testConfig,
            results,
            overallAverage: `${overallAverage.toFixed(2)} ms`
        });

        const cpuInfo = os.cpus()[0];
        const totalMemoryGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMemoryGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const osInfo = {
            type: os.type(),
            platform: os.platform(),
            release: os.release(),
            arch: os.arch()
        };

        // Prepare hardware information
        let hardwareInfo;
        try {
            const systemInfo = await si.getStaticData();
            hardwareInfo = {
                os: osInfo,
                cpu: {
                    model: cpuInfo.model,
                    speed: `${cpuInfo.speed} MHz`
                },
                totalMemory: `${totalMemoryGB} GB`,
                freeMemory: `${freeMemoryGB} GB`,
                gpu: systemInfo.graphics.controllers.map(gpu => ({
                    model: gpu.model,
                    vram: gpu.vram ? `${gpu.vram} MB` : 'N/A'
                })),
                system: {
                    manufacturer: systemInfo.system.manufacturer,
                    model: systemInfo.system.model,
                    version: systemInfo.system.version
                }
            };
        } catch (err) {
            console.error('Failed to retrieve system information:', err);
            hardwareInfo = {};
        }

        res.status(201).json({
            success: true,
            message: `Average execution time from ${testConfig.iterations} iterations: ${overallAverage.toFixed(2)} ms`,
            data: benchmark,
            hardware: hardwareInfo
        });
    } catch (error) {
        console.error('Error during benchmark execution:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};