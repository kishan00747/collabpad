const mode = process.env.mode;
const Redis = require('redis');
const redisServer = require('./constants').redisServer;
global.Promise = require('bluebird');
const HNOTES = "notes";
const HCOUNT = "count"

Promise.promisifyAll(Redis.RedisClient.prototype);
Promise.promisifyAll(Redis.Multi.prototype);
let redisClient;

console.log(mode);
if(mode === 'TESTING')
{
    var host = redisServer.host;
    var port = redisServer.port
    redisClient = Redis.createClient(
        {
            host, port
        }
    );
}
else if(mode === 'PRODUCTION')
{
    redisClient = Redis.createClient(
        redisServer.port,
        redisServer.host,
        redisServer.options
    );
}

redisClient
    .on('connect', () =>{
        console.log('Redis connected');
    });


const setNoteInRedis = (key, value) => {

    return redisClient.hsetAsync(HNOTES, key, value)
        .then((rep) => {
            const msg = {reply: rep}
            return msg;
        })
}

const getNoteFromRedis = (key) => {

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

const delNoteInRedis = (key) => {

    const msg = {reply: null};

    return redisClient.hdelAsync(HNOTES, key)
        .then( (reply) => {
            const msg = {reply}
            return msg;
        })
        .catch( e => {
            return msg;
        });

}


const setCountInRedis = (key) => {

    const msg = {value: null};


    return redisClient.hsetAsync(HCOUNT, key, 0)
        .then( (value) => {
            return {value};
        })
        .catch( e => {
            return msg;
        });
}

const getCountFromRedis = (key) => {

    const msg = {value: null};

    return redisClient.hgetAsync(HCOUNT, key)
        .then( (reply) => {
            const msg = {value: reply}
            return msg;
            }
        )
        .catch(e => {
            return msg;
        })
}

const delCountInRedis = (key) => {

    const msg = {reply: null};

    return redisClient.hdelAsync(HCOUNT, key)
        .then( (reply) => {
            const msg = {reply}
            return msg;
        })
        .catch( e => {
            return msg;
        })

}


const incrCountInRedis = (key) => {

    const msg = {value: null};
    
    return redisClient.hincrbyAsync(HCOUNT, key, 1)
        .then( (value) => {
            return {value};
        })
        .catch( e => {
            return msg;
        });

}

const decrCountInRedis = (key) => {

    const msg = {value: null};
    
    return redisClient.hincrbyAsync(HCOUNT, key, -1)
        .then( (value) => {
            return {value};
        })
        .catch( e => {
            return msg;
        });

}



// const setPassInRedis = (key, value) => {

//     return redisClient.hsetAsync(HPASS, key, value)
//         .then((rep) => {
//             const msg = {reply: rep}
//             return msg;
//         })
// }

// const getPassFromRedis = (key) => {

//     const msg = {value: null};

//     return redisClient.hgetAsync(HPASS, key)
//         .then( (reply) => {
//             const msg = {value: reply}
//             return msg;
//             }
//         )
//         .catch(e => {
//             return msg;
//         })
// }

// const delPassInRedis = (key) => {

//     const msg = {reply: null};

//     return redisClient.hdelAsync(HPASS, key)
//         .then( (reply) => {
//             const msg = {reply}
//             return msg;
//         })
//         .catch( e => {
//             return msg;
//         })

// }


module.exports = {
    setNoteInRedis,
    getNoteFromRedis,
    getCountFromRedis,
    delNoteInRedis,
    setCountInRedis,
    delCountInRedis,
    incrCountInRedis,
    decrCountInRedis
}