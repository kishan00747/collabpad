var ws = new WebSocket('ws://localhost:3002');
var textbox = document.getElementById("textbox");


var text = "";

var id = window.location.href.split("/").pop();

fetch('http://localhost:3002/notes/' + id)
    .then(response => response.json())
    .then(data => {
        text = data.value;
        textbox.value = data.value;
    })

setInterval( function() {

    if(text != textbox.value)
    {
        text = textbox.value;
        console.log(ws.readyState);
        if(ws.readyState === ws.OPEN)
        {
            var msg = {id, text}
            ws.send(JSON.stringify(msg));
        }   
    }

}, 3000);

