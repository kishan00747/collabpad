const express = require('express');
const redis = require('./redis.config');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const asyncMiddleware = require('./utils').asyncMiddleware;
const uniqid = require('uniqid');
const morgan = require('morgan');
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});


const app = express();
const expressWs = require('express-ws')(app);


app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined', {stream: accessLogStream}));



app.ws('/', (ws, req) => {

    ws.on('message', (msg) => {
        const response = JSON.parse(msg);
        redis.setDataInRedis(response.id, response.text);
    })
    
});

app.get('/', asyncMiddleware( async (req, res, next) => {

    const unid = await uniqid();
    await redis.setDataInRedis(unid, "");

    res.redirect("/" + unid);
     
}));


app.use(express.static(path.join(__dirname + "/frontend/")));


app.get('/:id', (req, res, next) => {  
    res.sendFile(path.join(__dirname + "/frontend/index.html"));
});

app.get('/notes/:key', asyncMiddleware( async (req, res, next) => {

    const key = req.params.key;
    const msg = await redis.getDataFromRedis(key);

    if(msg.value === null)
    {    
        res.status(404).send("Failed");
    }
    else
    {
        res.status(200).json(msg);
    }
    
}));






app.post('/:id', asyncMiddleware( async (req, res, next) => {

    const key = req.body.key;
    const value = req.body.value;

    res.status(200).json(await redis.setDataInRedis(key, value))

}));



app.listen(3002, () => {
    console.log("Server Running");
})

