const redisServer = {
    host: process.env.REDISCACHEHOSTNAME || '127.0.0.1',
    port: process.env.REDISPORT || 6379,
    options: {
        auth_pass:process.env.REDISCACHEKEY,
        tls: {servername: process.env.REDISCACHEHOSTNAME}
    }

}

const msgCode = {
    
   NEW_PATCH : 1,
   SEQ_NUM: 2,
   COLLAB_REM: 3,
   ASS_USERNAME: 4 

}


module.exports = {
    redisServer, msgCode
}