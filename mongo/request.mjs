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
    cryptoAddressVerified: {
        required: false,
        type: Boolean
    },
    email: {
        required: false,
        type: String
    },
    emailCode: {
        required: false,
        type: String
    },
    pubKey: {
        required: false,
        type: String
    },
    username: {
        required: false,
        type: String
    },
    accountMade: {
        required: true,
        type: Boolean
    },
    score: {
        required: true,
        type: Number
    }
})

export default mongoose.model('request', requestSchema)