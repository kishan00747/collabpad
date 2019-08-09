const Redis = require('redis');
const redisServer = require('constants').redisServer;
const Bluebird = require('bluebird');

Bluebird.promisifyAll(Redis.RedisClient.prototype);
Bluebird.promisifyAll(Redis.Multi.prototype);

const redisClient = Redis.createClient(
    redisServer
);

redisClient
    .on('connect', () =>{
        console.log('Redis connected');
    });


module.exports = redisClient;