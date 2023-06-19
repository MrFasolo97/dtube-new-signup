import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
    _id: {
        required: true,
        type: String
    },
    address: {
        required: true,
        type: String
    },
    email: {
        required: false,
        type: String
    },
    score: {
        required: false,
        type: Number
    }
})

export default mongoose.model('request', requestSchema)