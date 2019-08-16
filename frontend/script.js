var id = window.location.href.split("/").pop();
var textbox = document.getElementById("textbox");
var dmp = new diff_match_patch();
var ws;
var text = "";

function wsOnMessage(ev) {
    const data = JSON.parse(ev.data);
    const oldLength = textbox.value.length;
    const patch = dmp.patch_make(textbox.value, data.diffs);
    console.log(patch);
    const result = dmp.patch_apply(dmp.patch_make(textbox.value, data.diffs), textbox.value);
    let offset;
    const caretPosition = textbox.selectionStart;
    text = result[0];
    textbox.value = result[0];
    console.log(result[1]);

    if(patch)
    { 
        const checkDiff = (patch[0].diffs[0][0] === 0) ? patch[0].diffs[0][1].length : 0;
        if(caretPosition <= (patch[0].start1 + checkDiff) )
        {
            offset = 0;   
        }
        else
        {
            offset = (patch[0].length2 - patch[0].length1);
        }

        textbox.selectionStart = caretPosition + offset;
        textbox.selectionEnd = caretPosition + offset;
    }
}

function fetchNote() {
    
    fetch('http://localhost:3002/notes/' + id)
    .then(response => response.json())
    .then(data => {
        text = data.value;
        textbox.value = text;
    })
    .catch(err => {
        
    });

}

function initWS() {
ws = new WebSocket('ws://localhost:3002/'+id);

ws.onmessage = wsOnMessage;

}



initWS();
fetchNote();


//TO DO
// There are untracked changes after the patch is applied, which are hidden by the text = textbox.value; line 
// Make sure to work out a solution to that problem.



setInterval( function() {
    
    if(ws.readyState === ws.OPEN && text != textbox.value)
    {
        console.log(ws.readyState);
        text = textbox.value;
        if(ws.readyState === ws.OPEN)
        {
            var msg = {id, text}
            ws.send(JSON.stringify(msg));
        }   
    }

}, 1000);

setInterval( function() {
    if(ws.readyState !== ws.OPEN)
    {
        initWS();
    }
}, 3000)

