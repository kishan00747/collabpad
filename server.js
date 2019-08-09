const express = require('express');
const app = express();
const expressWs = require('express-ws') (app);



app.ws('/', (ws, req) => {
    
    ws.on('message', (msg) => {
        const text = JSON.parse(msg);
        console.log(msg);
    })   
});

app.listen(3002, () => {
    console.log("Server Running");
});