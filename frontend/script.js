var id = window.location.href.split("/").pop();

var ws = new WebSocket('ws://localhost:3002/'+id);
var textbox = document.getElementById("textbox");


var text = "";


fetch('http://localhost:3002/notes/' + id)
    .then(response => response.json())
    .then(data => {
        text = data.value;
        textbox.value = data.value;
    });

ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    text = data.text;
    textbox.value = data.text;
}

setInterval( function() {

    if(text != textbox.value)
    {
        console.log(ws.readyState);
        text = textbox.value;
        if(ws.readyState === ws.OPEN)
        {
            var msg = {id, text}
            ws.send(JSON.stringify(msg));
        }   
    }

}, 3000);

