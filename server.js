const express = require('express');
const redisClient = require('./redis.config');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const asyncMiddleware = require('./utils').asyncMiddleware;
const morgan = require('morgan');
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});


const app = express();


app.use(bodyParser.json());
app.use(morgan('combined', {stream: accessLogStream}));


app.get('/:key', asyncMiddleware( async (req, res, next) => {

    const key = req.params.key;
    const msg = await getDataFromRedis(key);

    if(msg.value === null)
    {    
        res.status(404).send();
    }
    else
    {
        res.status(200).json(msg);
    }
    
}));


app.post('/', asyncMiddleware( async (req, res, next) => {

    const key = req.body.key;
    const value = req.body.value;

    res.status(200).json(await setDataInRedis(key, value))

}));


const setDataInRedis = (key, value) => {

    return redisClient.setAsync(key, value)
        .then((rep) => {
            const msg = {reply: rep}
            return msg;
        })
}

const getDataFromRedis = (key) => {

    return redisClient.getAsync(key)
        .then( (reply) => {
            const msg = {value: reply}
            return msg;
            }
        )

}




app.listen(3002, () => {
    console.log("Server Running");
})

