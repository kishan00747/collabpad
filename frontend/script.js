window.onload = function() 
{
    var id = window.location.href.split("/").pop();
    var host = window.location.host;
    
    var textbox = document.getElementById("textbox");
    var inputPass = document.getElementById("input_pass");
    var btnPass = document.getElementById("btn_pass");
    var modalMessage = document.getElementById("modal_message");
    var modalPass = document.getElementById("modal_pass");
    var btnSubmitPass = document.getElementById("btn_submit_pass");
    var modalBtnCancel = document.getElementById("btn_cancel_pass");

    var dmp = new diff_match_patch();
    textbox.disabled = true;
    textbox.placeholder = "Note is loading, Please wait...";
    textbox.value = '';
    var ws = null;
    var deliveredText = "";
    var timeout = null;
    var lastUpdatedCopy = "";
    var isNoteLoaded = false;
    var sentTextList = {};
    var seqNo = 0;

    btnPass.onclick = onBtnPassClick;
    modalBtnCancel.onclick = onModalBtnCancelClick;
    btnSubmitPass.onclick = onBtnSubmitPassClick;

    window.onclick = function(ev){
        if(ev.target === modalPass)
        {
            modalPass.style.display = "none";
        }
    }

    function onModalBtnCancelClick(ev){
        modalPass.style.display = "none";
    }

    function onBtnSubmitPassClick(ev){


        if(inputPass.value.length < 4 || inputPass.value.length > 20)
        {
            modalMessage.innerText = "Password must be 4-20 characters long.";
            modalMessage.style.display = "block";
            modalMessage.classList.add('text-error');
            modalMessage.classList.remove('text-success');
            return;
        }
        else
        {
            modalMessage.style.display = "none";
        }

        var data = {
            id,
            password: inputPass.value
        }
        
        fetch('http://' + host + '/notes/password/', {
            method: 'POST',
            body: JSON.stringify(data), 
            headers:{
              'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            if(data.reply !== -1)
            {
                modalMessage.innerText = "Password Changed successfully!";
                modalMessage.style.display = "block";
                modalMessage.classList.remove('text-error');
                modalMessage.classList.add('text-success');
            }
            else
            {
                modalMessage.innerText = "Error occured while updating password!";
                modalMessage.style.display = "block";
                modalMessage.classList.add('text-error');
                modalMessage.classList.remove('text-success');
            }
        })
    }

    function onBtnPassClick(ev){
        modalPass.style.display = "block";
    }


    function wsConnect() {
        ws = new WebSocket('ws://' + host + '/' + id);

        ws.onopen = function() {
            // console.log(textbox.value);
            fetchAndPatch(); 
            console.log('Socket opened');
        };

        ws.onmessage = wsOnMessage;

        ws.onclose = function(ev) {
            console.log("Socket is closed. Retrying in 3 secs...", ev.reason);
            setTimeout(function(){
                wsConnect();
            }, 3000)

            console.log("onclose", ws.readyState);
        };

        ws.onerror = function(err) {
            console.error('Socket encountered an error: ', err, 'Closing Socket...');
            ws.close();
            console.log("onerror", ws.readyState);
        }

    }


    function wsOnMessage(ev) { 
            
        const data = JSON.parse(ev.data);
        if(data.seq !== undefined)
        {
            var seq = data.seq;
            deliveredText = sentTextList[seq];
            delete sentTextList[seq];
        }
        else if(data.patches)
        {
            patchTextboxFromPatches(data.patches);
            //sendChanges();
        }
        else
        {
            // console.log("unrecognized message");
        }
       
    }

    function patchTextboxFromPatches(patches) {
        console.log(patches);
        const result = dmp.patch_apply(patches, textbox.value);
        let offset;
        const caretPosition = textbox.selectionStart;
        lastUpdatedCopy = result[0];
        textbox.value = result[0];

        if(patches && (patches.length !== 0) )
        { 
            offset = getCaretOffset(patches, caretPosition);

            textbox.selectionStart = caretPosition + offset;
            textbox.selectionEnd = caretPosition + offset;
        }

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
        
        return fetch('http://' + host + '/notes/' + id)
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
            // deliveredText = value;
            serverNotePatch(value);
            noteLoadChecker();

        }
        sendChanges();
    }  

    function noteLoadChecker(){
        if(!isNoteLoaded)
            {
                isNoteLoaded = true;
                textbox.disabled = false;
                textbox.placeholder = "Write Here...";
            }
    }


    function serverNotePatch(serverNote)
    {
        var patches = dmp.patch_make(lastUpdatedCopy, serverNote);
        patchTextboxFromPatches(patches);
    }


    textbox.onkeyup = function() {

        if(timeout === null)
        {
            timeout = setTimeout(sendChanges, 200);
        }
        else
        {
            clearTimeout(timeout);
            timeout = setTimeout(sendChanges, 200); 
        }
    };


    function sendChanges() {

        
        // console.log(deliveredText !== textbox.value);
        
        if(ws.readyState === ws.OPEN && deliveredText !== textbox.value)
        {
            var seq = seqNo++;
            var text = textbox.value;
            var cursor = textbox.selectionEnd;
            sentTextList[seq] = text; 
            var msg = {id, seq, text, cursor}
            ws.send(JSON.stringify(msg)); 
        }

    };


    wsConnect();

}