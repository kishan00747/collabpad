var ws = new WebSocket('ws://localhost:3002');
var textbox = document.getElementById("textbox");

var text = "";

setInterval( function() {

    if(text != textbox.value)
    {
        text = textbox.value;

        if(ws.readyState === ws.OPEN)
        {
            ws.send(JSON.stringify({text}));
        }   
    }

}, 3000);