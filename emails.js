const nodemailer = require('nodemailer')
const config = require('./config.js')
const senderAddress = "noreply@signup.dtube.fso.ovh"
const emailConfig = {
    host: "smtp.mailersend.net",
    port: 587,
    secure: false,
    auth: {
      user: config.nodemailer.username,
      pass: config.nodemailer.password
    }
}

try {
    transporter = nodemailer.createTransport(emailConfig)
    console.log("Connected to SMTP.")
} catch (e) {
    console.log(e)
}


var emails = {
    sent: [],
    send: (realRecipient, recipient, subject, uuid, ip, cb) => {
        if (!emails.validate(recipient)) {
            cb(recipient+' is not a valid email')
            return
        }

        if (emails.limited(realRecipient, ip)) {
            console.log(realRecipient)
            console.log(ip)
            cb('Maximum rate limit exceeded. Please wait a few minutes and try again.')
            return
        }
        var link = config.protocol+config.domain+'/completeSignup/'+encodeURIComponent(uuid)
        var text = "To continue the account creation process, please click on the following link:\n"
        var htmlText = text.replace('\n','<br/>')
        text += link+' \r\n Please, don\'t reply, this email account isn\'t monitored.'
        htmlText += '<a href="'+link+'">'+link+'</a><br/><br/>Please, don\'t reply, this email account isn\'t monitored.'
        transporter.sendMail({
            from: '"DTube Signup" <'+senderAddress+'>',
            to: recipient,
            subject: subject,
            text: text,
            html: htmlText
        }, function(err, res) {
            if (err) cb(err)
            else {
                cb(null, res)
                console.log('sent email to '+recipient)
                emails.sent.push({
                    recipient: realRecipient,
                    ts: new Date().getTime(),
                    ip: ip
                })
            }
        });
    },
    sendContact: (recipient, subject, text, ip, cb) => {
        if (recipient.split('@')[1] !== 'd.tube')  {
            cb('A contact email requires a @d.tube recipient.')
            return
        }
        var htmlText = text.replace('\n','<br/>')
        transporter.sendMail({
            from: '"DTube Bot" <no-reply@d.tube>',
            to: recipient,
            subject: subject,
            text: text,
            html: htmlText
        }, function(err, res) {
            if (err) cb(err)
            else cb(null, res)
        });
    },
    validate: (recipient) => {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        return re.test(recipient)
    },
    removeEmailTricks: (recipient) => {
        // see https://gmail.googleblog.com/2008/03/2-hidden-ways-to-get-more-from-your.html

        // handle email plus(+) sign addressing trick
        // many email providers do this
        let realRecipient = recipient
        if (recipient.indexOf('+') > -1 && recipient.indexOf('+') < recipient.indexOf('@'))
            realRecipient = recipient.split('@')[0].split('+')[0] + '@' + recipient.split('@')[1]

        // and dot(.) sign
        // google mail only
        let googleEmailDomains = [
            'gmail.com',
            'googlemail.com'
        ]
        if (googleEmailDomains.indexOf(realRecipient.split('@')[1]) > -1)
            realRecipient = realRecipient.split('@')[0].replace(/\./g, '') + '@' + realRecipient.split('@')[1]

        if (recipient != realRecipient)
            console.log('Email trick detected: '+recipient+' -> '+realRecipient)

        return realRecipient
    },
    limited: (recipient, ip) => {
        var blacklist = [
        'tashjw.com',
        'psk3n.com',
        'dffwer.com',
        'lerwfv.com',
        'qortu.com',
        'dfb55.com',
        'lywenw.com',
        'mailnd7.com',
        'aaorsi.com',
        'tcwlm.com']
	    var domain = recipient.split('@')[1]
	    if (blacklist.indexOf(domain) > -1)
	        return true

        var countRecipient = 0
        var countIp = 0
        for (let i = emails.sent.length-1; i >= 0; i--) {
            if (emails.sent[i].recipient == recipient)
                countRecipient++
            if (emails.sent[i].ip == ip)
                countIp++
        }

        if (countRecipient >= config.limits.emailCount || countIp >= config.limits.emailCount)
            return true

        return false
    },
    purge: () => {
        for (let i = emails.sent.length-1; i >= 0; i--) {
            if (emails.sent[i].ts < new Date().getTime() - config.limits.emailPeriod)
                emails.sent.splice(i, 1)
        }
    }
}

setInterval(function() {
    emails.purge();
}, 1000*60)

module.exports = emails
