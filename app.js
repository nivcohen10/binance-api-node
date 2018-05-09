const binance = require('node-binance-api');
const axios = require('axios');
const mongoose = require('mongoose');
const express = require('express');
const app = express();
const Ticker = require('./common/models/ticker')
const Transaction = require('./common/models/transaction')
const Balance = require('./common/models/balance')



const dbName = process.env.DB_NAME || "test";
const buyPrice = process.env.BUY_PRICE || 0.993;
const sellPrice = process.env.SELL_PRICE || 1.005;


mongoose.connect('mongodb://binance-api:binance-api@binance-api-shard-00-00-ksjtb.mongodb.net:27017,binance-api-shard-00-01-ksjtb.mongodb.net:27017,binance-api-shard-00-02-ksjtb.mongodb.net:27017/' + dbName + '?ssl=true&replicaSet=binance-api-shard-0&authSource=admin', );

app.listen(process.env.PORT || 5000, () => {
    console.log("started")
});

app.use((req, res, next) => {
    console.log("api")
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method == 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET ,PUT ,POST');
        return res.status(200).json({});
    }
    return res.status(200).json({});
});


binance.options({
    APIKEY: 'vcR3xvFgivgxE84x0apBlouTrRYHt5oCTxnJfZxb6A8Z8yfkQAQiQwElcw2yuBzN',
    APISECRET: '9btQw9hWbxGVsjJeNoBFae4w8mUVdA4hO4F9PMMAddaKraH21dC5DmM6maUv0Iyq',
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    test: false // If you want to use sandbox mode where orders are simulated
});



function tickerFunc() {
    // https://www.bitstamp.net/api/ticker
    console.log("Running", Date.now())
    GetBitcoinPriceFromCoindesk()
        .then(response => {
            binance.prices((error, ticker) => {
                const usdtPrice = response.data.bpi.USD.rate_float / ticker.BTCUSDT;
                GetMode().then(mode => {
                    const tickerObj = new Ticker({
                        _id: mongoose.Types.ObjectId(),
                        mode: mode,
                        usdt_price: usdtPrice,
                        target_price: mode == "Sell" ? sellPrice : buyPrice,
                    }).save();

                    if (mode == "Sell" && usdtPrice > sellPrice) {
                        BuyBitcoin();
                    }
                    if (mode == "Buy" && usdtPrice < buyPrice) { // buy usdt, sell bitcoin
                        SellBitcoin();
                    }
                }) // sell usdt, buy bitcoin
            });
        })
        .catch(error => {
            //console.log(error);
        });

    // cancel all open orders
    // binance.cancelOrders("XMRBTC", (error, response, symbol) => {
    //console.log(symbol+" cancel response:", response);
    // });

    /*      Placing a MARKET order
    // These orders will be executed at current market price.
    var quantity = 1;
    binance.marketBuy("BNBBTC", quantity);
    binance.marketSell("ETHBTC", quantity); */
}

function balanceFunc() {
    GetBitcoinPriceFromCoindesk().then(response => {
        const bitcoinPrice = response.data.bpi.USD.rate_float;
        GetBalances().then(balances => {
            const usdt = balances.USDT;
            const bitcoin = balances.BTC;
            var total = Number(usdt.available) + Number(usdt.onOrder) + Number(bitcoin.available * bitcoinPrice) + Number(bitcoin.onOrder * bitcoinPrice);
            // todo: store in db
            const balance = new Balance({
                usdt: usdt,
                bitcoin: bitcoin,
                total: total
            }).save()
        })
    })
}

try {
    setInterval(tickerFunc, 10000);
    setInterval(balanceFunc, 10000 * 6 * 60);
}
catch (error) {
    {
        console.log("Exception:", error);
        setInterval(tickerFunc, 10000);
        setInterval(balanceFunc, 10000 * 6 * 60);
    }
}

function GetMode() {
    return new Promise((resolve, reject) => {
        Transaction.findOne().sort({ "createdAt": -1 }).exec().then(res => {
            if (res) {
                if (res.mode == "Buy")
                    resolve("Sell");
                else
                    resolve("Sell")
            }
            else
                resolve("Sell");
        }).catch(err => {
            resolve("Sell");
        })
    })
}

function BuyBitcoin() {
    GetBalances().then(balances => {
        const usdtBalance = balances.USDT.available;
        GetBitcoinTicker().then(ticker => {
            const bitcoinAsk = ticker.askPrice;
            const btcQuantityToBuy = (Math.floor((usdtBalance / bitcoinAsk * 0.95) * 1000) / 1000).toFixed(3);

            binance.buy("BTCUSDT", btcQuantityToBuy, bitcoinAsk, { type: 'LIMIT' }, (error, response) => {
                const ticker = new Ticker({
                    _id: mongoose.Types.ObjectId(),
                    type: "Sell",
                    target_price: sellPrice,
                    description: "Sell usdt, Buy bitcoin",
                    transactionDetails: response
                }).save();
            });
        });
    });
}

function SellBitcoin() {
    GetBalances().then(balances => {
        const btcBalance = balances.BTC.available;
        GetBitcoinTicker()
            .then(ticker => {
                const bitcoinBid = ticker.bidPrice;
                const btcQuantityToSell = (Math.floor(btcBalance * 0.95 * 1000) / 1000).toFixed(3);

                binance.sell("BTCUSDT", btcQuantityToSell, bitcoinBid, { type: 'LIMIT' }, (error, response) => {
                    const ticker = new Ticker({
                        _id: mongoose.Types.ObjectId(),
                        type: "Buy",
                        target_price: buyPrice,
                        description: "Buy usdt, Sell bitcoin",
                        transactionDetails: response
                    }).save();
                });
            })
    });
}

function GetBalances() {
    return new Promise((resolve, reject) => {
        binance.balance((error, balances) => {
            if (error) reject(error);
            else resolve(balances);
        });
    })

}

function GetBitcoinTicker() {
    return new Promise((resolve, reject) => {
        binance.bookTickers('BTCUSDT', (error, ticker) => {
            if (error) reject(error);
            else resolve(ticker);
        });
    })
}

function GetBitcoinPriceFromCoindesk() {
    return axios.get('https://api.coindesk.com/v1/bpi/currentprice.json')
}