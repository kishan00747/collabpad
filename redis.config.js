const Redis = require('redis');
const redisServer = require('constants').redisServer;
global.Promise = require('bluebird');
const HNOTES = "notes";

Promise.promisifyAll(Redis.RedisClient.prototype);
Promise.promisifyAll(Redis.Multi.prototype);

const redisClient = Redis.createClient(
    redisServer
);

redisClient
    .on('connect', () =>{
        console.log('Redis connected');
    });


const setDataInRedis = (key, value) => {

    return redisClient.hsetAsync(HNOTES, key, value)
        .then((rep) => {
            const msg = {reply: rep}
            return msg;
        })
}

const getDataFromRedis = (key) => {

    const msg = {value: null};

    return redisClient.hgetAsync(HNOTES, key)
        .then( (reply) => {
            const msg = {value: reply}
            return msg;
            }
        )
        .catch(e => {
            return msg;
        })

}


module.exports = {
    redisClient,
    setDataInRedis,
    getDataFromRedis
}