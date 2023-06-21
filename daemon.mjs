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
const indexPage = fs.readFileSync("html/index.html")
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

app.get('/signup', (req, res) => {
  res.send("")  
});


app.use(bodyParser.urlencoded({ extended: true }))
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
  if(typeof validateUsername(username, 50,
    9,
    'abcdefghijklmnopqrstuvwxyz0123456789',
    '-.') === 'string') {
    res.send(validateUsername(username, 50,
      9,
      'abcdefghijklmnopqrstuvwxyz0123456789',
      '-.'));
  } else {
    axios.get(API_ADDRESS + "account/" + username).then((response) => {
      if (response.status == 200) {
          res.send("<span style='color: red;'>Username is Not Available.</span>")
        }
    }).catch((err) => {
      if (err.response.status == 404) {
        res.send("<span style='color: green;'>Username is Available.</span>")
      } else {
        throw err
      }
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

app.get('/ethers.min.js', (req, res) => {
  res.type('html/ethers.min.js');
  res.send(fs.readFileSync("html/ethers.min.js"));
})

app.use(bodyParser.urlencoded({ extended: true }))
app.post('/signupPage', (req, res) => {
  let { address, token } = req.body;
  mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
        await requestSchema.findOne({"address": address, _id: token}).then((request) => {
          if(request === null) {
            res.status(400).send("Invalid request!");
          } else {
            res.type("html");
            res.send(indexPage);
          }
        }).catch((reason) => {
          if(reason) throw reason;
        })
      });
})

app.post('/getPassport/:address', (req, res) => {
  let { address } = req.params;
  axios.get(GET_PASSPORT_SCORE_URI+SCORER_ID+"/"+address, {headers: {"X-API-KEY": config.GC_API_KEY}, timeout: 20000}).then((result) => {
    let returnValue = result.data;
    if (result.data.score >= 15) {
      mongoose.connect(config.MONGODB_ADDRESS_DB+'?readPreference=primary&appname=dtube-signup&directConnection=true&ssl=false', { useNewUrlParser: true, useUnifiedTopology: true}).then(async(db) => {
        await requestSchema.findOne({"address": address}).then((request) => {
          let address, token;
          if (request === null) {
            const _id = randomUUID();
            requestSchema.create({"_id": _id, "address": address, "score": result.data.score});
            address = address;
            token = _id;
          } else {
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

let port = 3000;
app.get('/', (req, res) => {
  res.type("html");
  res.send(passportPage);
});

app.listen(port, () => {
  logger.info(`Listening on port ${port}`);
});