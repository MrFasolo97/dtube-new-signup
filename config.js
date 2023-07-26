var config = {
    avalon: {
        api: process.env.AVALON_API || 'https://testnet.dtube.fso.ovh',
        priv: process.env.AVALON_PRIV || 'fff',
        account: process.env.AVALON_USER || 'dtube',
    },
    protocol: process.env.PROTOCOL || 'https://',
    ssl: process.env.ENABLE_SSL || false,
    domain: process.env.DOMAIN || "localhost:3000",
    hcaptchaSecret: process.env.HCAPTCHA_SECRET || "aaa",
    enableCaptcha: true,
    port: process.env.PORT || 3002,
    aws: {
        id: process.env.AWS_ID || "123",
        secret: process.env.AWS_SECRET || "bbb"
    },
    fb: {
        id: process.env.FB_ID || "456",
        secret: process.env.FB_SECRET || "ccc"
    },
    google: {
        id: process.env.GOOGLE_ID || "123",
        secret: process.env.GOOGLE_SECRET || "bbb"
    },
    github: {
        id: process.env.GITHUB_ID || "123",
        secret: process.env.GITHUB_SECRET || "bbb"
    },
    twitter: {
        id: process.env.TWITTER_ID || "123",
        secret: process.env.TWITTER_SECRET || "bbb"
    },
    telegram: {
        id: process.env.TELEGRAM_ID || "123",
        secret: process.env.TELEGRAM_SECRET || "bbb"
    },
    coinbase: {
        apiKey: process.env.COINBASE_API || 'ddd',
        secret: process.env.COINBASE_SECRET || 'eee'
    },
    nodemailer: {
        username: process.env.MAIL_USERNAME || 'fff',
        password: process.env.MAIL_PASSWORD || 'ggg'
    },
    limits: {
        maxTokensSold: 1000000,
        smsCount: 3,
        smsPeriod: 1000*60*60*24,
        emailCount: 5,
        emailPeriod: 1000*60*60*24,
        smsCodeAttempts: 3
    },
    GC_API_KEY: process.env.GC_API_KEY || "aaa",
    GC_PASSPORT_THRESHOLD: process.env.GC_PASSPORT_THRESHOLD || 15,
    MONGODB_ADDRESS_DB: process.env.MONGODB_ADDRESS_DB || "mongodb://127.0.0.1:27017/signup",
    logLevel: process.env.LOG_LEVEL || "debug"
}

module.exports = config
