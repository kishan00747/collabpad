var id = window.location.href.split("/").pop();
var textbox = document.getElementById("textbox");
var dmp = new diff_match_patch();
var ws = null;
var sentText = "";
var timeout = null;
var patchList = [];


function wsConnect() {
    ws = new WebSocket('ws://172.16.172.137:3002/' + id);

    ws.onopen = function() {
        console.log('Socket opened');
    };

    ws.onmessage = wsOnMessage;

    ws.onclose = function(ev) {
        console.log("Socket is closed. Retrying in 3 secs...", ev.reason);
        setTimeout(function(){
            wsConnect();
        }, 3000)
    };

    ws.onerror = function(err) {
        console.error('Socket encountered an error: ', err.message, 'Closing Socket...');
        ws.close();
    }

}


function wsOnMessage(ev) {

    const data = JSON.parse(ev.data);
    const oldLength = textbox.value.length;
    patchTextbox(data.diffs);
    sendChanges();
}

function patchTextbox(diffs) {
    const patch = dmp.patch_make(textbox.value, diffs);
    // console.log(patch);
    const result = dmp.patch_apply(dmp.patch_make(textbox.value, diffs), textbox.value);
    let offset;
    const caretPosition = textbox.selectionStart;
    // sentText = result[0];
    textbox.value = result[0];
    // console.log(result[1]);

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

    // console.log(result[0]);
}

function fetchNote() {
    
    return fetch('http://172.16.172.137:3002/notes/' + id)
    .then(response => response.json())
    .then(data => {
        return data.value;
    })
    .catch(err => {
        // console.log("Note fetch failed!");
        return null;
    });

}

async function setNote() {
    var value = await fetchNote();
    if(value !== null)
    {
        sentText = value;
        textbox.value = value;
    }
}  



function serverNotePatch(serverNote)
{
    const localNote = textbox.value;
    var diffs = dmp.diff_main(localNote, serverNote);
    patchTextbox(diffs);
}






textbox.onkeyup = function() {


    if(timeout === null)
    {
        timeout = setTimeout(sendChanges, 500);
    }
    else
    {
        clearTimeout(timeout);
        timeout = setTimeout(sendChanges, 500); 
    }
};


function sendChanges() {
    
    if(ws.readyState === ws.OPEN && sentText != textbox.value)
    {
        console.log(ws.readyState);
        sentText = textbox.value;
        var text = sentText;
        if(ws.readyState === ws.OPEN)
        {
            var msg = {id, text}
            ws.send(JSON.stringify(msg));
        }
    }

};


wsConnect();
setNote();