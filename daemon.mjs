import express from 'express';;
import RateLimit from 'express-rate-limit';
import log4js from 'log4js';
import avalon from 'javalon';
import * as fs from 'fs';
import axios from 'axios';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import bodyParser from 'body-parser';
import { ethers } from 'ethers';
import sanitize from 'sanitize-filename';
import validateUsername from './username_validation.mjs';
import requestSchema from './mongo/request.mjs';
import oldAccountSchema from './mongo/oldAccount.mjs';
import emails from './emails.js';
import config from './config.js';

mongoose.set('strictQuery', false);


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
// app.set('trust proxy', true);
const indexPage = fs.readFileSync("html/index.html", { encoding: "utf-8" })
const passportPage = fs.readFileSync("html/passport.html")
const confirmAccountPage = fs.readFileSync("html/confirmAccount.html", { encoding: "utf-8" })
const GET_PASSPORT_SCORE_URI = `https://api.scorer.gitcoin.co/registry/score/`
// endpoint for submitting passport
const SUBMIT_PASSPORT_URI = 'https://api.scorer.gitcoin.co/registry/submit-passport'
// endpoint for getting the signing message
const SIGNING_MESSAGE_URI = 'https://api.scorer.gitcoin.co/registry/signing-message'
avalon.init({api: config.avalon.api});

const limiter = RateLimit({
  windowMs: 1*60*1000, // 1 minute
  max: 10
});

function createAccAndFeed(username, pubKey, give_bw, give_vt, give_dtc) {
  logger.info('Creating '+username+' '+pubKey)
  var txData = {
      pub: pubKey,
      name: username,
      bw: give_bw
  }
  var newTx = {
      type: 24,
      data: txData
  }
  if (validateUsername(username, 50, 9, 'abcdefghijklmnopqrstuvwxyz0123456789', '-.') !== true) {
      logger.warn("Invalid account request catched!");
      return
  }
  newTx = avalon.sign(config.avalon.priv, config.avalon.account, newTx)
  avalon.sendTransaction(newTx, function(err, res) {
      if (err) {
        logger.error(err);
        return;
      }
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
              newTx = avalon.sign(config.avalon.priv, config.avalon.account, newTx)
              avalon.sendTransaction(newTx, function(err, res) {})
          }

          if (give_bw && false) {
              var newTx = {
                  type: 15,
                  data: {
                      amount: give_bw,
                      receiver: username
                  }
              }
              newTx = avalon.sign(config.avalon.priv, config.avalon.account, newTx)
              avalon.sendTransaction(newTx, function(err, res) {})
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
              newTx = avalon.sign(config.avalon.priv, config.avalon.account_dtc, newTx)
              avalon.sendTransaction(newTx, function(err, res) {})
          }
      }, 6000)
  })
}

app.get('/completeSignup/:uuid', (req, res) => {
  logger.debug(req.params);
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then((db) => {
    requestSchema.findOne({emailCode: req.params.uuid, score: {$gte: config.GC_PASSPORT_THRESHOLD}}).then((result) => {
      if(result !== null && result.accountMade !== true && validateUsername(result.username, 50, 9, 'abcdefghijklmnopqrstuvwxyz0123456789', '-.') == true) {
        res.send(confirmAccountPage.replace("{{USERNAME}}", result.username).replace("{{PUBLIC_KEY}}", result.pubKey).replace("{{UUID}}", result.emailCode));
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
    requestSchema.findOne({emailCode: req.params.uuid, accountMade: false, score: {$gte: config.GC_PASSPORT_THRESHOLD}}).then((result) => {
      if(result !== null && result.username !== null && result.pubKey !== null && validateUsername(result.username, 50, 9, 'abcdefghijklmnopqrstuvwxyz0123456789', '-.') == true) {
        createAccAndFeed(result.username, result.pubKey, 10000, 200)
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
    res.status(500).send("Email required!");
    throw new Error("Email not defined!");
  }
  const { username, pubKey } = req.body;
  const address = encodeURIComponent(req.params.address);
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then((db) => {
    logger.info(email);
    logger.info(address);
    logger.info(pubKey);
    oldAccountSchema.findOne({email: String(email)}).then((oldAccount) => {
      if(oldAccount !== null && oldAccount.pub !== null && oldAccount.username !== null && oldAccount.finalized == true) {
        res.status(500).send("There is already an account made with this email address.");
      } else
        requestSchema.findOne({address: address, accountMade: true}).then((account) => {
          if (account !== null) {
            res.send("There is already an account made with this ethereum address.");
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
          }).catch((reason) => {
            if(reason) throw reason;
            res.status(500).send("Something went wrong! Please, retry.");
          });
        }
      }).catch((reason) => {
        if(reason) throw reason;
          res.status(500).send("Something went wrong! Please, retry.");  
      })
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

app.post('/checkUsername/:username', (req, res) => {
  const username = encodeURIComponent(req.params.username);
  const validation = validateUsername(username, 50, 9, 'abcdefghijklmnopqrstuvwxyz0123456789', '-.')
  if(validation !== true) {
    res.status(202).send(validation);
  } else {
    axios.get(config.avalon.api + "/account/" + encodeURIComponent(username), { validateStatus: false }).then((response) => {
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

app.use('/js', limiter);
app.get('/js/:file', (req, res) => {
  let file = sanitize(req.params.file);
  res.type(file);
  try {
    res.send(fs.readFileSync("html/js/"+file));
  } catch(e) {
    //logger.warn(e);
    logger.warn(`IP ${req.headers['x-forwarded-for']} asked for missing file: "${file}" (folder "js")`);
    res.status(404);
    res.type("text/plain");
    res.send("Not found!");
  }
})


app.use('/legal', limiter);
app.get('/legal/:file', (req, res) => {
  let file = sanitize(req.params.file);
  res.charset = 'utf-8';
  res.type("html");
  try {
    res.send(fs.readFileSync("html/legal/"+file));
  } catch(e) {
    logger.warn(e);
    logger.warn(`IP ${req.headers['x-forwarded-for']} asked for missing file: "${file}" (folder "legal")`);
    res.status(404);
    res.type("text/plain");
    res.send("Not found!");
  }
})


app.post('/getPassport/:address', (req, res) => {
  let address = encodeURIComponent(req.params.address);
  if (address !== null) {
    axios.get(GET_PASSPORT_SCORE_URI+SCORER_ID+"/"+address, {headers: {"X-API-KEY": config.GC_API_KEY}, timeout: 20000}).then((result) => {
      let returnValue = result.data;
      if (+result.data.score >= config.GC_PASSPORT_THRESHOLD) {
        mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
          await requestSchema.findOne({address: address}).then((request) => {
            let token;
            if (request === null) {
              const _id = randomUUID();
              const emailCode = randomUUID();
              requestSchema.create({_id: _id, address: address, score: result.data.score, email: "", emailCode: emailCode, pubKey: "", username: "", accountMade: false});
              token = _id;
              returnValue.accountMade = false;
            } else if (request.accountMade === false || typeof request.accountMade === 'undefined') {
              address = request.address;
              token = request._id;
              returnValue.accountMade = false;
            } else {
              returnValue.accountMade = request.accountMade;
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
  } else {
    res.status(400).send("Address missing!");
  }
});

app.use(express.json())
app.post('/submitPassport/:address/:signature/:nonce', (req, res) => {
  const { message } = req.body;
  axios.post(SUBMIT_PASSPORT_URI,
        {
          address: req.params.address,
          scorer_id: SCORER_ID,
          signature: req.params.signature,
          nonce: req.params.nonce
        },
        { headers: {"X-API-KEY": config.GC_API_KEY}}
        ).then((response) => {
          if (response.data.score >= config.GC_PASSPORT_THRESHOLD) {
            mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
              await requestSchema.findOne({address: req.params.address}).then((request) => {
                let addressFromSignature = ethers.verifyMessage(message, req.params.signature);
                logger.debug(addressFromSignature);
                if(addressFromSignature.length >= 40 && addressFromSignature === req.params.address) {
                  request.nonce = req.params.nonce;
                  request.signature = req.params.signature;
                  request.cryptoAddressVerified = true;
                  request.save();
                }
              });
            });
          }
          res.send(response.data);
        }).catch((reason) => {
          logger.warn(reason);
        });
})

app.use(bodyParser.urlencoded({ extended: true }))
app.post('/signupPage', (req, res) => {
  let { address, token } = req.body;
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
        await requestSchema.findOne({address: String(address), _id: String(token)}).then((request) => {
          if(request === null) {
            res.status(400).send("Invalid request!");
          } else {
            res.type("html");
            res.send(indexPage.replace("{{USER_ETH_ADDRESS}}", encodeURIComponent(address)));
          }
        }).catch((reason) => {
          if(reason) throw reason;
        })
      });
})

app.get('/', (req, res) => {
  res.type("html");
  res.send(passportPage);
});

app.listen(config.port, () => {
  logger.info(`Listening on port ${config.port}`);
});
