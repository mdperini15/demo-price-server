const Joi = require('@hapi/joi');

const currencyPairsServer = require('./currencyPairsServer');

if (typeof localStorage === 'undefined' || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./.user-data');
}

function executeTransaction(userid, transaction, tick) {
  var response = {
    success: false
  };

  let rate = null;

  console.log('executeTransaction --------');
  if (transaction.priceType === 'SPOT') {
    if (transaction.side == 'BUY') {
      if (transaction.amount > tick.bidLiquidity) {
        response.message = 'Amount greater than current liquidity.';
      } else {
        rate = tick.bidRate;
        tick.bidLiquidity -= transaction.amount;
      }
    }

    if (transaction.side == 'SELL') {
      if (transaction.amount > tick.termLiquidity) {
        response.message = 'Amount greater than current liquidity.';
      } else {
        rate = tick.termRate;
        tick.termLiquidity -= transaction.amount;
      }
    }
  }

  if (rate) {
    transaction.date = new Date().toISOString();
    transaction.rate = rate;
    transaction.total = transaction.rate * transaction.amount;
    response.transaction = transaction;
    response.success = true;
    saveTransaction(userid, transaction);
    console.log(`success -------- ${userid}`); // ${JSON.stringify(transaction)} 
  } else {
    if (!response.message) {
      response.message = 'Transaction not supported.';
    }
  }
 
  return response;
}

function getTransactions(userid) {
  let data = localStorage.getItem('transactions-' + userid);
  return data ? JSON.parse(data) : [];
}

function saveTransaction(userid, transaction) {
  let transactions = getTransactions(userid);
  transactions.push(transaction);
  localStorage.setItem('transactions-' + userid, JSON.stringify(transactions));
}

function init(server) {
  server.route({
    method: 'GET',
    path: '/transactions',
    handler: (request, h) => {
      return getTransactions(request.headers.userid);
    },
    options: {
      description: 'Get user transactions',
      tags: ['api'],
      validate: {
        headers: {
          userid: Joi.string().required()
        },
        options: {
          allowUnknown: true
        }
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/transactions',
    handler: (request, h) => {
      console.log('executeTransaction', JSON.stringify(request.payload));

      let ccy = currencyPairsServer.getCurrencyPair(request.payload.symbol);
      if (ccy) {
        if (ccy.lastTick) {
          let execution = executeTransaction(request.headers.userid, request.payload, ccy.lastTick);
          return h.response(execution).code(execution.success ? 200 : 500);
        } else {
          return h
            .response({
              success: false,
              message: `Symbol ${request.payload.symbol} not priced yet.`
            })
            .code(404);
        }
      } else {
        return h
          .response({
            success: false,
            message: `Symbol ${request.payload.symbol} not found`
          })
          .code(404);
      }
    },
    options: {
      description: 'Execute a transaction',
      tags: ['api'],
      validate: {
        headers: {
          userid: Joi.string().required()
        },
        payload: Joi.object({
          symbol: Joi.string().required(),
          priceType: Joi.string()
            .valid('SPOT')
            .required(),
          side: Joi.string()
            .valid('BUY', 'SELL')
            .required(),
          amount: Joi.number().min(1)
        }).label('transaction'),
        options: {
          allowUnknown: true
        }
      }
    }
  });
}

module.exports = {
  init: init
};