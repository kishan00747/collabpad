const express = require('express');
const redis = require('redis');
const bodyParser = require('body-parser');


const app = express();
const redisClient = redis.createClient();

app.use(bodyParser.json());

app.get('/:key', (req, res) => {

    const key = req.params.key

    redisClient.get(key, (err, reply) => {

        if(reply === null)
        {    
            res.status(404).send();
        }
        else
        {
            const msg = {
                value: reply
            }
    
            res.status(200).json(msg);
        }
        
    })
});


app.post('/', (req, res) => {

    const key = req.body.key;
    const value = req.body.value;

    redisClient.set(key, value, (err, rep) => {
        const msg = {
            reply: rep
        }
        res.status(200).json(msg);
    })

})






app.listen(3002, () => {
    console.log("Server Running");
})

