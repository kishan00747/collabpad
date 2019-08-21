const express = require('express');
const port = process.env.PORT || 3002;
const redis = require('./redis.config');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const asyncMiddleware = require('./utils').asyncMiddleware;
const uniqid = require('uniqid');
const morgan = require('morgan');
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});
const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();


const app = express();
const expressWs = require('express-ws')(app);


app.use(cors());
app.use(bodyParser.json());
app.use(morgan('combined', {stream: accessLogStream}));

let clients = {};

app.ws('/:id', (ws, req) => {

    const id = req.params.id;

    if (!clients[id]) {
        clients[id] = [ws];
    } else {
        clients[id].push(ws);
    }

    ws.on('message', async (msg) => {
        const response = JSON.parse(msg);
        
        const note = await redis.getDataFromRedis(response.id);
        const patches = dmp.patch_make(note.value, response.text);
        
        redis.setDataInRedis(response.id, response.text);
    
        const broadcastList = clients[response.id];
        const broadcastMsg = {patches}
        
        broadcastList.forEach( (wsc, i) => {

            if( !(wsc === ws) )
            {
                try
                {
                    wsc.send(JSON.stringify(broadcastMsg));
                }
                catch(err)
                {
                    broadcastList.splice(i, 1);
                }
            }
            
        });
        
    })
    
});

app.get('/', asyncMiddleware( async (req, res, next) => {

    const unid = await uniqid();
    await redis.setDataInRedis(unid, "");

    res.redirect("/" + unid);
     
}));


app.use(express.static(path.join(__dirname + "/frontend/")));


app.get('/:id', async (req, res, next) => {  

    const id = req.params.id;
    const note = await redis.getDataFromRedis(id);
    if(note.value === null)
    {
        await redis.setDataInRedis(id, "");
    }

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


app.listen(port, () => {
    console.log("Server Running");
})

