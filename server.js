const mode = process.env.mode;
const express = require('express');
const msgCode = require('./constants').msgCode;
const port = process.env.PORT || 3002;
const redis = require('./redis.config');
const fs = require('fs');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const cors = require('cors');
const path = require('path');
const nodeRandomName = require('node-random-name');
const bodyParser = require('body-parser');
const asyncMiddleware = require('./utils').asyncMiddleware;
const uniqid = require('uniqid');
const morgan = require('morgan');
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});
const DiffMatchPatch = require('diff-match-patch');
const session = require('express-session');


const app = express();
const expressWs = require('express-ws')(app);
const dmp = new DiffMatchPatch();

var forceSsl = function (req, res, next) {
    if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(['https://', req.get('host'), req.url].join(''));
    }
    return next();
 };

if (mode === 'PRODUCTION') {
    app.use(forceSsl);
}


app.use(cors());

app.use(session({
  secret: 'ninja cat',
  resave: false,
  saveUninitialized: true,
  cookie: {
      maxAge: 3600000
  }
}));

app.use(bodyParser.json());
app.use(morgan('combined', {stream: accessLogStream}));

let clients = {};

app.ws('/:id', (ws, req) => {

    const id = req.params.id;

    ws['clname'] = nodeRandomName();
    ws.send(JSON.stringify(
        {
            msgCode: msgCode.ASS_USERNAME,
            clname: ws['clname']
        }
    ));

    if (!clients[id]) 
    {     
        clients[id] = [ws];
    } else 
    {
        clients[id].push(ws);
    }

    ws.on('message', (msg) => {

        try
        {
            const response = JSON.parse(msg);
        
            switch(response.msgCode)
            {
                case msgCode.PING:
                    {

                    }
                    break;

                case msgCode.NEW_UPDATE:
                    {
                        handleNewUpdate(ws, response);
                    }
                    break;

                default:
                    {

                    }
            }
        }
        catch(e)
        {
            console.log(e);
        }
        
    });
});

handleNewUpdate = async (ws, response) => 
{
    const note = await redis.getNoteFromRedis(response.id);
        const patches = dmp.patch_make(note.value, response.text);
        
        await redis.setNoteInRedis(response.id, dmp.patch_apply(patches, note.value)[0]);

        const seq = response.seq;
        ws.send(JSON.stringify(
            {
                msgCode: msgCode.SEQ_NUM,
                seq
        }));

        const broadcastList = clients[response.id];
        var cursorPos = response.cursorPos;
        var clname = ws['clname'];
        const broadcastMsg = {
            msgCode: msgCode.NEW_PATCH,
            patches,
            cursorPos,
            clname
        };
        
        broadcastList.forEach( (wsc, i) => {

            if( !(wsc === ws) )
            {
                if(wsc.readyState !== 1)
                {
                    broadcastList.splice(i, 1);
                    notifySocketDown(broadcastList, wsc);
                }
                else
                {
                    wsc.send(JSON.stringify(broadcastMsg));
                }
            }
            
        });
        
}


notifySocketDown = (broadCastList, closedSocket) =>
{
    var broadcastMsg = {
        msgCode: msgCode.COLLAB_REM,
        clname: closedSocket.clname
    }

    broadCastList.forEach( (wsc, i) => {
        if(wsc.readyState === 1)
        {
            wsc.send(JSON.stringify(broadcastMsg));
        }
    });

}

app.get('/', asyncMiddleware( async (req, res, next) => {

    const unid = await uniqid();
    await redis.setNoteInRedis(unid, "");
    await redis.setPassInRedis(unid, "");

    res.redirect("/" + unid);
     
}));

app.use(express.static(path.join(__dirname + "/frontend/")));

app.post('/notes/password/', asyncMiddleware( async( req, res, next) => {

    const id = req.body.id;
    const pass = req.body.password;

    if(pass !== undefined && id !== undefined)
    {
        const note = await redis.getNoteFromRedis(id);

        if(note.value !== null)
        {
            const hashPass = await bcrypt.hash(pass, saltRounds);
            const result = await redis.setPassInRedis(id, hashPass); 
            res.status(200).json(result);    
        }
        else
        {
            res.status(404).send();
        }
        
    }
    else
    {
        const result = {reply: -1};
        res.status(400).json(result);
    }

}));

app.post('/notes/authenticate/', asyncMiddleware( async( req, res, next) => {

    const id = req.body.id;
    const pass = req.body.password;

    if(pass !== undefined && id !== undefined)
    {
        try
        {
            const redisRes = await redis.getPassFromRedis(id);
            const hashPass = redisRes.value;
            const match = await bcrypt.compare(pass, hashPass);
            const response = {reply: match};
            
            if(match === true)
            {
                response.redirect = id;
                sess = req.session;
                if(sess.urls)
                {
                    sess.urls[id] = hashPass;
                }
                else
                {
                    sess.urls = {};
                    sess.urls[id] = hashPass;
                }
                
            }
            res.status(200).json(response);
        }
        catch(err)
        {
            res.status(404).json({reply: false});
        }
    }
    else
    {
        res.status(400).json({reply: false});
    }


}));




app.get('/:id', async (req, res, next) => {  

    const id = req.params.id;
    const note = await redis.getNoteFromRedis(id);
    if(note.value === null)
    {
        await redis.setNoteInRedis(id, "");
        await redis.setPassInRedis(id, "");
        res.sendFile(path.join(__dirname + "/frontend/index.html"));
    }
    else
    {

        const reply = await redis.getPassFromRedis(id);
        const pass = reply.value;
        if(pass === "" || pass === await bcrypt.hash("", saltRounds))
        {
            res.sendFile(path.join(__dirname + "/frontend/index.html"));
        }
        else
        {
            sess = req.session;
            
            if(sess.urls !== undefined && sess.urls[id] !== undefined)
            {
                const redisPass = await redis.getPassFromRedis(id);
                if(sess.urls[id] === redisPass.value)
                {
                    res.sendFile(path.join(__dirname + "/frontend/index.html"));
                }
                else
                {
                    res.sendFile(path.join(__dirname + "/frontend/index_protected.html"));
                }
            }
            else
            {
                res.sendFile(path.join(__dirname + "/frontend/index_protected.html"));
            }
            

        }
    }

    
});

app.get('/notes/:key', asyncMiddleware( async (req, res, next) => {

    const key = req.params.key;
    const msg = await redis.getNoteFromRedis(key);

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

