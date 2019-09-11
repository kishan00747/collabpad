const mode = process.env.mode;
const express = require('express');
const msgCode = require('./constants').msgCode;
const port = process.env.PORT || 3002;
const redis = require('./redis.config');
const mongo = require('./mongo.config');
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

app.ws('/:id', asyncMiddleware( async (ws, req)  => {

    const id = req.params.id;

    
    ws['clname'] = nodeRandomName();
    ws['noteId'] = id;
    ws.send(JSON.stringify(
        {
            msgCode: msgCode.ASS_USERNAME,
            clname: ws['clname']
        }
    ));

    await incrementAndLoadNoteToRedis(id);

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

    ws.on('close', (msg) => {
        notifySocketDown(clients[id], ws);
        persistNoteInMongo(id);
    })


}));


incrementAndLoadNoteToRedis = async (id) => {
    
    let count = await redis.incrCountInRedis(id);
    count = count.value;

    if(count == 1)
    {
        return loadNoteInRedis(id);
    }
    else
    {
        return 0;
    }

}




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
                }
                else
                {
                    wsc.send(JSON.stringify(broadcastMsg));
                }
            }
            
        });
        
}

persistNoteInMongo = async (id) => {
    const count = await redis.decrCountInRedis(id);
    if(count.value === 0)
    {
        const note = await redis.getNoteFromRedis(id);
        if(await mongo.updateNote(id, note.value))
        {
            await redis.delNoteInRedis(id);
        }
    }
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
    await mongo.createNote(unid, "");
    await loadNoteInRedis(unid);
    
    res.redirect("/" + unid);
     
}));

loadNoteInRedis = (key) => {
    const notePromise = new Promise( async (resolve, reject) => {
        try
        {
            const note = await mongo.getNote(key);
            await redis.setNoteInRedis(key, note.value);
            resolve();
        }
        catch
        {
            reject();
        }
    });

    return notePromise;
}

isNoteInRedis = async (key) => {
    const count = await redis.getCountFromRedis(id);

    if(count === null)
    {
        return false;
    }

    return (count.value !== 0);

}


app.use(express.static(path.join(__dirname + "/frontend/")));

app.post('/notes/password/', asyncMiddleware( async( req, res, next) => {

    const id = req.body.id;
    const pass = req.body.password;

    if(pass !== undefined && id !== undefined)
    {
        const note = await mongo.getNote(id);

        if(note !== null)
        {
            const hashPass = await bcrypt.hash(pass, saltRounds);
            const result = await mongo.updatePass(id, hashPass); 
            res.status(200).json({reply: result}); 
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
            const noteObj = await mongo.getNote(id);
            if(noteObj === null)
            {
                return res.status(400).json({reply: false});
            }
            const hashPass = noteObj.pass;
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
    const note = await mongo.getNote(id);

    if(note === null)
    {
        await mongo.createNote(unid, "");
        await loadNoteInRedis(unid);
        res.sendFile(path.join(__dirname + "/frontend/index.html"));
    }
    else
    {
        const pass = note.pass;
        if(pass === "" || pass === await bcrypt.hash("", saltRounds))
        {
            res.sendFile(path.join(__dirname + "/frontend/index.html"));
        }
        else
        {
            sess = req.session;
            
            if(sess.urls !== undefined && sess.urls[id] !== undefined)
            {
                if(sess.urls[id] === pass)
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
    const msg = await redis.getCountFromRedis(key);
    let note;

    if(msg.value == 0)
    {
        note = await mongo.getNote(key);
    }
    else
    {
        note = await redis.getNoteFromRedis(key);

        if(note.value === null)
        {
            note = await mongo.getNote(key);
        }
        else
        {
            note = note.value;
        }

    }

    if(note === null)
    {    
        res.status(404).send("Failed");
    }
    else
    {
        res.status(200).json({value: note});
    }
    
}));


app.listen(port, () => {
    console.log("Server Running");
})

