const redisServer = {
    host: process.env.redisHost || "172.16.172.124",
    port: process.env.redisPort || 6379
}


module.exports = {
    redisServer
}