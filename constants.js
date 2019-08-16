const redisServer = {
    host: process.env.redisHost || '127.0.0.1',
    port: process.env.redisPort || 6379
}


module.exports = {
    redisServer
}