import express, { urlencoded } from 'express';;
import log4js from 'log4js';
import * as javalon from 'javalon';
import * as fs from 'fs';
import axios from 'axios';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import bodyParser from 'body-parser';
import validateUsername from './username_validation.mjs';
import requestSchema from './mongo/request.mjs';
import emails from './emails.js';

mongoose.set('strictQuery', false);
let config = JSON.parse(fs.readFileSync("config.json"));


log4js.configure({
    appenders: {
      logs: { type: 'file', filename: 'logs/logs.log' },
      console: { type: 'console' },
    },
    categories: {
      logs: { appenders: ['logs'], level: 'trace' },
      console: { appenders: ['console'], level: 'trace' },
      default: { appenders: ['console', 'logs'], level: 'info' },
    },
  });

const SCORER_ID = "1222";

const logger = log4js.getLogger();
const app = express();
logger.level = config.logLevel || "DEBUG";
app.set('trust proxy', true);
const indexPage = fs.readFileSync("html/index.html", { encoding: "utf-8" })
const passportPage = fs.readFileSync("html/passport.html")
const GET_PASSPORT_SCORE_URI = `https://api.scorer.gitcoin.co/registry/score/`
// endpoint for submitting passport
const SUBMIT_PASSPORT_URI = 'https://api.scorer.gitcoin.co/registry/submit-passport'
// endpoint for getting the signing message
const SIGNING_MESSAGE_URI = 'https://api.scorer.gitcoin.co/registry/signing-message'


function createAccAndFeed(username, pubKey, give_bw, give_vt, give_dtc) {
  logger.info('Creating '+username+' '+pubKey)
  var txData = {
      pub: pubKey,
      name: username
  }
  var newTx = {
      type: 0,
      data: txData
  }
  newTx = javalon.sign(config.avalon.priv, config.avalon.account, newTx)
  javalon.sendTransaction(newTx, function(err, res) {
      if (err) return
      logger.info('Feeding '+username)
      setTimeout(function() {
          if (give_vt) {
              var newTx = {
                  type: 14,
                  data: {
                      amount: give_vt,
                      receiver: username
                  }
              }
              newTx = javalon.sign(config.avalon.priv, config.avalon.account, newTx)
              javalon.sendTransaction(newTx, function(err, res) {})
          }

          if (give_bw) {
              var newTx = {
                  type: 15,
                  data: {
                      amount: give_bw,
                      receiver: username
                  }
              }
              newTx = javalon.sign(config.avalon.priv, config.avalon.account, newTx)
              javalon.sendTransaction(newTx, function(err, res) {})
          }
          
          if (give_dtc) {
              var newTx = {
                  type: 3,
                  data: {
                      amount: give_dtc,
                      receiver: username,
                      memo: 'Thank you for signing up!'
                  }
              }
              newTx = javalon.sign(config.avalon.priv, config.avalon.account_dtc, newTx)
              javalon.sendTransaction(newTx, function(err, res) {})
          }
      }, 6000)
  })
}

app.get('/completeSignup/:uuid', (req, res) => {
  logger.debug(req.params);
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then((db) => {
    requestSchema.findOne({emailCode: req.params.uuid, score: {$gte: 15}}).then((result) => {
      if(result !== null && result.accountMade !== true) {
        res.send("Please, confirm your data:<br /><br />Username: "+result.username+"<br /><br />Public Key: "+result.pubKey+"<br /><br/>If your public key from previous steps matches this one, and you backed-up your private key, and the username is the one you did chose, please go ahead and click the link below. If something is wrong, please stop here and ask for help on our <a href='https://discord.gg/dtube'>Discord</a>!<br /><br /><a href='/congratulations/"+req.params.uuid+"'>Confirm account!</a>");
      } else {
        logger.debug(result);
        res.send("Something went wrong! Please, retry");
      }
    }).catch((reason) => {
      logger.warn(reason);
    });
  }).catch((reason) => {
    logger.warn(reason);
  });
});

app.get('/congratulations/:uuid', (req, res) => {
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then((db) => {
    requestSchema.findOne({emailCode: req.params.uuid, accountMade: false, score: {$gte: 15}}).then((result) => {
      if(result !== null && result.username !== null && result.pubKey !== null) {
        result.accountMade = true;
        result.save();
        res.send("Congratulations! This is your channel:<br /><a href='https://d.tube/c/"+result.username+"'>"+result.username+"</a>");
      }
    });
  });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.post('/saveUserData/:address', (req, res) => {
  let email = emails.removeEmailTricks(req.body.email) || req.body.email;
  if (email === null || typeof email === 'undefined') {
    res.status(500).send("");
    throw new Error("Email not defined!");
  }
  const { username, pubKey } = req.body;
  const { address } = req.params;
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then((db) => {
    console.log(email);
    console.log(address);
    console.log(pubKey);
      requestSchema.findOne({address: address, accountMade: true}).then((account) => {
        if (account !== null) {
          res.send("There is already an account made with this email address.");
        } else {
          requestSchema.findOne({address: address}).then((request) => {
            if (request === null) {
              res.status(400).send("Invalid request!");
            } else if (request.accountMade !== true) {
              const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress; 
              const email2 = emails.removeEmailTricks(email) || email;
              emails.send(emails.removeEmailTricks(email2), email2, "DTube Signup", request.emailCode, ipAddress, (err, res) => {
                if (err) {
                  res.status(500).send("Something went wrong while sending the email...");
                  throw err;
                }
                request.email = email2;
                request.username = username;
                request.pubKey = pubKey;
                request.save();
                res.send("OK, check your email!");
              });
            } else if (request.accountMade === true) {
              res.send("You already have an account!");
            } else {
              res.status(500).send("Something went wrong! Please, retry.");
            }
        });
      }
    }).catch((reason) => {
      if(reason) throw reason;
      res.status(500).send("Something went wrong! Please, retry.");  
  }).catch((reason) => {
    if(reason) throw reason;
    res.status(500).send("Something went wrong! Please, retry.");
  });
  });
});

app.use(bodyParser.urlencoded({ extended: true }));
app.post('/signup', (req, res) => {
  let username = req.body.username
  let email = req.body.email
  logger.info(username)
  logger.info(email)
  res.send("")
});

const API_ADDRESS = "https://avalon.d.tube/"
app.post('/checkUsername/:username', (req, res) => {
  const { username } = req.params;
  const validation = validateUsername(username, 50, 9, 'abcdefghijklmnopqrstuvwxyz0123456789', '-.')
  if(validation !== true) {
    res.status(202).send(validation);
  } else {
    axios.get(API_ADDRESS + "account/" + username, { validateStatus: false }).then((response) => {
      if (response.status === 200) {
        res.status(202).send("<span style='color: red;'>Username is Not Available.</span>");
      } else if (response.status === 404) {
        res.send("<span style='color: green;'>Username is Available.</span>");
      }
    }).catch((err) => {
      throw err;
    })
  }
})

app.post('/getSigningMessage', (req, res) => {
  axios.get(SIGNING_MESSAGE_URI, {headers: {"X-API-KEY": config.GC_API_KEY}, timeout: 20000}).then((result) => {
    res.send([result.data.message, result.data.nonce]);
  }).catch((reason) => {
    logger.error('error: ', reason)
  });
});

app.get('/submitPassport/:address/:signature/:nonce', (req, res) => {
  axios.post(SUBMIT_PASSPORT_URI,
        {
          address: req.params.address,
          scorer_id: SCORER_ID,
          signature: req.params.signature,
          nonce: req.params.nonce
        },
        { headers: {"X-API-KEY": config.GC_API_KEY}}
        ).then((response) => {
          res.send(response.data);
        }).catch((reason) => {
          logger.warn(reason);
        });
})

app.get('/js/:file', (req, res) => {
  let { file } = req.params;
  res.type('html/js/'+file);
  res.send(fs.readFileSync("html/js/"+file));
})

app.post('/getPassport/:address', (req, res) => {
  let { address } = req.params;
  axios.get(GET_PASSPORT_SCORE_URI+SCORER_ID+"/"+address, {headers: {"X-API-KEY": config.GC_API_KEY}, timeout: 20000}).then((result) => {
    let returnValue = result.data;
    if (result.data.score >= 15) {
      mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
        await requestSchema.findOne({address: address}).then((request) => {
          let token;
          if (request === null) {
            const _id = randomUUID();
            const emailCode = randomUUID();
            requestSchema.create({_id: _id, address: address, score: result.data.score, email: "", emailCode: emailCode, pubKey: "", username: "", accountMade: false});
            token = _id;
          } else if (request.accountMade === false || typeof request.accountMade === 'undefined') {
            address = request.address;
            token = request._id;
          }
          returnValue.address = address;
          returnValue.token = token;         
          res.send(returnValue);
        }).catch((reason) => {
          if (reason) throw reason;
        })
      });
    } else {
      res.send(returnValue);
    }
  }).catch((reason) => {
    logger.warn(reason)
    res.status(400).send("Error!");
  });
});

app.use(bodyParser.urlencoded({ extended: true }))
app.post('/signupPage', (req, res) => {
  let { address, token } = req.body;
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
        await requestSchema.findOne({address: address, _id: token}).then((request) => {
          if(request === null) {
            res.status(400).send("Invalid request!");
          } else {
            res.type("html");
            res.send(indexPage.replace("{{USER_ETH_ADDRESS}}", address));
          }
        }).catch((reason) => {
          if(reason) throw reason;
        })
      });
})

let port = 3002;
app.get('/', (req, res) => {
  res.type("html");
  res.send(passportPage);
});

app.listen(port, () => {
  logger.info(`Listening on port ${port}`);
});