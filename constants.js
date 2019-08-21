const redisServer = {
    host: process.env.REDISCACHEHOSTNAME || '127.0.0.1',
    port: process.env.REDISPORT || 6379,
    options: {
        auth_pass:process.env.REDISCACHEKEY,
        tls: {servername: process.env.REDISCACHEHOSTNAME}
    }

}


module.exports = {
    redisServer
}