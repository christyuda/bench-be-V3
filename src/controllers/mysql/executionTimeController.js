const ExecutionTimeBenchmark = require('../../models/mysql/ExecutionTimeBenchmark');
const os = require('os');
const si = require('systeminformation');
const escomplex = require('escomplex');
const { performance } = require('perf_hooks');
const { ObjectId } = require('bson');
const babel = require('@babel/core');

// Fungsi untuk transpilasi kode
async function transpileCode(code, type) {
    const presets = [];
    if (type === 'React' || type === 'Vue') {
        presets.push('@babel/preset-react');
    }
    if (type === 'Angular') {
        presets.push('@babel/preset-typescript');
    }

    try {
        const result = await babel.transformAsync(code, {
            presets: presets,
            filename: `inputCode.${type.toLowerCase()}`
        });
        return result.code;
    } catch (error) {
        console.error('Error during code transpilation:', error.message);
        throw new Error('Transpilation failed: ' + error.message);
    }
}

exports.startBenchmark = async (req, res) => {
    const { testType, testCodes, testConfig, javascriptType } = req.body;
    const warmupIterations = 5; // Jumlah iterasi pemanasan

    if (!testType || !testCodes || !testConfig || !javascriptType) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    try {
        const transpiledCodes = await Promise.all(testCodes.map(code => transpileCode(code, javascriptType)));

        const results = transpiledCodes.map((code, index) => {
            let iterationsResults = [];
            let complexityReport = escomplex.analyse(code);
            let complexitySummary = {
                cyclomatic: complexityReport.aggregate.cyclomatic,
                sloc: complexityReport.aggregate.sloc,
                halstead: complexityReport.aggregate.halstead,
                maintainability: complexityReport.aggregate.maintainability
            };

            // Iterasi pemanasan
            for (let i = 0; i < warmupIterations; i++) {
                const functionToTest = new Function('return ' + code);
                functionToTest();
            }

            for (let i = 0; i < testConfig.iterations; i++) {
                const startTime = performance.now();
                const functionToTest = new Function('return ' + code);
                functionToTest();
                const endTime = performance.now();
                const executionTime = endTime - startTime;

                iterationsResults.push({
                    iteration: i + 1,
                    executionTime: `${executionTime.toFixed(2)} ms`
                });
            }
            const averageExecutionTime = iterationsResults.reduce((acc, curr) => acc + parseFloat(curr.executionTime), 0) / testConfig.iterations;
            const totalExecutionTime = iterationsResults.reduce((acc, curr) => acc + parseFloat(curr.executionTime), 0);

            return {
                testCodeNumber: index + 1,
                testCode: code,
                iterationsResults: iterationsResults,
                averageExecutionTime: `${averageExecutionTime.toFixed(2)} ms`,
                totalExecutionTime: `${totalExecutionTime.toFixed(2)} ms`,
                complexity: complexitySummary
            };
        });

        const overallAverage = results.reduce((acc, curr) => acc + parseFloat(curr.averageExecutionTime), 0) / results.length;
        const totalExecutionTimeSum = results.reduce((acc, curr) => acc + parseFloat(curr.totalExecutionTime), 0);

        const mongoId = new ObjectId().toString();
        const userId = req.user._id;
        const benchmark = await ExecutionTimeBenchmark.create({
            userId: req.user._id,
            mongoId,
            javascriptType,
            testType,
            testConfig,
            results,
            overallAverage: `${overallAverage.toFixed(2)} ms`,
            totalExecutionTime: `${totalExecutionTimeSum.toFixed(2)} ms`
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

        let systemInfo = {};
        try {
            systemInfo = await si.getStaticData();
        } catch (error) {
            console.error('Failed to retrieve system information:', error);
        }

        const hardwareInfo = {
            os: osInfo,
            cpu: {
                model: cpuInfo.model,
                speed: `${cpuInfo.speed} MHz`
            },
            totalMemory: `${totalMemoryGB} GB`,
            freeMemory: `${freeMemoryGB} GB`,
            gpu: systemInfo.graphics ? systemInfo.graphics.controllers.map(gpu => ({
                model: gpu.model,
                vram: gpu.vram ? `${gpu.vram} MB` : 'N/A'
            })) : [{ model: 'Not available', vram: 'N/A' }],
            system: systemInfo.system ? {
                manufacturer: systemInfo.system.manufacturer,
                model: systemInfo.system.model,
                version: systemInfo.system.version
            } : { manufacturer: 'Not available', model: 'Not available', version: 'Not available' }
        };

        res.status(201).json({
            success: true,
            status: '201 created',

            message: `Average execution time from ${testConfig.iterations} iterations: ${overallAverage.toFixed(2)} ms`,
            data: benchmark,
            hardware: hardwareInfo
        });
    } catch (error) {
        console.error('Error during benchmark execution:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};



exports.getUserBenchmarks = async (req, res) => {
    try {
        const benchmarks = await ExecutionTimeBenchmark.findAll({
            where: { userId: req.user._id }
        });
        res.status(200).json({
            success: true,
            data: benchmarks
        });
    } catch (error) {
        console.error('Error fetching user benchmarks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};