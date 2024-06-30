const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PageLoadBenchmarkSchema = new Schema({
    javascriptType: {
        type: String,
        required: true
    },
    testType: {
        type: String,
        required: true
    },
    testConfig: {
        type: Object,
        required: true
    },
    results: {
        type: Array,
        required: true
    },
    overallAverage: {
        type: String,
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('PageLoadBenchmark', PageLoadBenchmarkSchema);
