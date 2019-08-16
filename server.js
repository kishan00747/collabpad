const express = require('express');
const port = process.env.port || 3002;
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

// app.ws('/:id', (ws, req) => {

//     const id = req.params.id;

//     if (!clients[id]) {
//         clients[id] = [ws];
//     } else {
//         clients[id].push(ws);
//     }

//     // console.log(clients);

//     ws.on('message', (msg) => {
//         const response = JSON.parse(msg);
//         redis.setDataInRedis(response.id, response.text);

//         const broadcastList = clients[response.id];
//         // console.log(broadcastList)
//         const broadcastMsg = {text: response.text}
//         broadcastList.forEach(ws => {
//             try
//             {
//                 ws.send(JSON.stringify(broadcastMsg));
//             }
//             catch(err)
//             {
//                 console.log(err);
//             }
//         });
        
//     })
    
// });

app.ws('/:id', (ws, req) => {

    const id = req.params.id;

    if (!clients[id]) {
        clients[id] = [ws];
    } else {
        clients[id].push(ws);
    }

    // console.log(clients);

    ws.on('message', async (msg) => {
        const response = JSON.parse(msg);
        
        const note = await redis.getDataFromRedis(response.id);
        const diffs = dmp.diff_main(note.value, response.text);
        
        redis.setDataInRedis(response.id, response.text);
    
        const broadcastList = clients[response.id];
        // console.log(broadcastList)
        const broadcastMsg = {diffs}
        broadcastList.forEach(wsc => {

            if( !(wsc === ws) )
            {
                try
                {
                    wsc.send(JSON.stringify(broadcastMsg));
                }
                catch(err)
                {
                    console.log("Socket Closed, Couldn't send!");
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






app.post('/:id', asyncMiddleware( async (req, res, next) => {

    const key = req.body.key;
    const value = req.body.value;

    res.status(200).json(await redis.setDataInRedis(key, value))

}));



app.listen(port, () => {
    console.log("Server Running");
})

