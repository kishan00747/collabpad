window.onload = function() 
{
    var id = window.location.href.split("/").pop();
    var host = window.location.host;
    var textbox = document.getElementById("textbox");
    var dmp = new diff_match_patch();
    textbox.disabled = true;
    textbox.placeholder = "Note is loading, Please wait...";
    textbox.value = '';
    var ws = null;
    var sentText = "";
    var timeout = null;
    var lastUpdatedCopy = "";
    var isNoteLoaded = false;


    function wsConnect() {
        ws = new WebSocket('wss://' + host + '/' + id);

        ws.onopen = function() {
            // console.log(textbox.value);
            fetchAndPatch();
            console.log('Socket opened');
            if(!isNoteLoaded)
            {
                isNoteLoaded = true;
                textbox.disabled = false;
                textbox.placeholder = "Write Here...";
            }

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
        patchTextboxFromPatches(data.patches);
        // sendChanges();
    }

    function patchTextboxFromPatches(patches) {
        const result = dmp.patch_apply(patches, textbox.value);
        let offset;
        const caretPosition = textbox.selectionStart;
        lastUpdatedCopy = result[0];
        textbox.value = result[0];
        // console.log(result[1]);

        if(patches && (patches.length !== 0) )
        { 
            offset = getCaretOffset(patches, caretPosition);

            textbox.selectionStart = caretPosition + offset;
            textbox.selectionEnd = caretPosition + offset;
        }

        // console.log(result[0]);
    }

    function getCaretOffset(patches, caretPosition)
    {
        const checkDiff = (patches[0].diffs[0][0] === 0) ? patches[0].diffs[0][1].length : 0;
        if(caretPosition <= (patches[0].start1 + checkDiff) )
        {
            return 0;   
        }
        else
        {
            return (patches[0].length2 - patches[0].length1);
        }
    }

    function fetchNote() {
        
        return fetch('https://' + host + '/notes/' + id)
        .then(response => response.json())
        .then(data => {
            return data.value;
        })
        .catch(err => {
            // console.log("Note fetch failed!");
            return null;
        });

    }

    async function fetchAndPatch() {
        var value = await fetchNote();
        if(value !== null)
        {
            // sentText = value;
            serverNotePatch(value);
        }
        sendChanges();
    }  


    function serverNotePatch(serverNote)
    {
        var patches = dmp.patch_make(lastUpdatedCopy, serverNote);
        patchTextboxFromPatches(patches);
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
}