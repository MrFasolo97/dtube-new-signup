import mongoose from "mongoose";


const oldAccountSchema = new mongoose.Schema({
    _id: {
        required: true,
        type: Object,
    },
    email: {
        required: true,
        type: String,
    },
    birth: {
        required: false,
        type: String,
    },
    startTime: {
        required: false,
        type: Number,
    },
    pub: {
        required: false,
        type: String,
    },
    finalized: {
        required: false,
        type: Boolean,
    },
    optin: {
        required: false,
        type: Boolean,
    },
    birth: {
        required: false,
        type: String,
    },
    ref: {
        required: false,
        type: Boolean,
    },
    startTime: {
        required: false,
        type: Number,
    },
    username: {
        type: String,
        required: false,
    }
});

export default mongoose.model('account', oldAccountSchema);