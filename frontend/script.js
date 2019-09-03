window.onload = function() 
{
    var id = window.location.href.split("/").pop();
    var host = window.location.host;
    
    var textbox = document.getElementById("textbox");
    var textOverlay = document.getElementById("text-overlay");
    var inputPass = document.getElementById("input_pass");
    var btnPass = document.getElementById("btn_pass");
    var btnUsers = document.getElementById("btn_users");
    var modalMessage = document.getElementById("modal_message");
    var modalPass = document.getElementById("modal_pass");
    var modalUsers = document.getElementById("modal_users");
    var btnSubmitPass = document.getElementById("btn_submit_pass");
    var modalPassBtnCancel = document.getElementById("btn_cancel_pass");
    var modalUsersBtnCancel = document.getElementById("btn_cancel_users");
    var patchList = [];

    var dmp = new diff_match_patch();
    textbox.disabled = true;
    textbox.placeholder = "Note is loading, Please wait...";
    textbox.value = '';
    var user = {
        cp: 0,
        color: "#ffffff"
    };
    var ws = null;
    var deliveredText = "";
    var timeoutSend = null;
    var timeoutPatch = null;
    var lastUpdatedCopy = "";
    var isNoteLoaded = false;
    var sentTextList = {};
    var seqNo = 0;

    var collabCursors = [];

    btnPass.onclick = onBtnPassClick;
    modalPassBtnCancel.onclick = onModalPassBtnCancelClick;
    btnSubmitPass.onclick = onBtnSubmitPassClick;

    btnUsers.onclick = onBtnUsersClick;
    modalUsersBtnCancel.onclick = onModalUsersBtnCancelClick;

    window.onclick = function(ev){
        if(ev.target === modalPass)
        {
            modalPass.style.display = "none";
            onModalPassBtnCancelClick();
        }
        else if(ev.target === modalUsers)
        {
            modalUsers.style.display = "none";
            onModalUsersBtnCancelClick();
        }
    }

    function onBtnUsersClick(ev){
        modalUsers.style.display = "block";
        var modalBody = modalUsers.getElementsByClassName("modal-body")[0];
        
        var ul = document.createElement("ul");

        // var li = document.createElement("li");
        // li.appendChild(document.createTextNode(user.clname));
        // ul.appendChild(li);

        collabCursors.forEach( function(user, i) {

            var li = document.createElement("li");
            li.appendChild(document.createTextNode(user.clname));
            var colorSpan = document.createElement("span");
            colorSpan.classList.add("colorRect");
            colorSpan.style.backgroundColor = user.color;
            li.appendChild(colorSpan);
            ul.appendChild(li);

        });

        modalBody.appendChild(ul);
        

    }

    function onModalUsersBtnCancelClick(ev){
        var modalBody = modalUsers.getElementsByClassName("modal-body")[0];
        modalBody.removeChild(modalBody.querySelector("ul"));
        modalUsers.style.display = "none";
    }

    function onModalPassBtnCancelClick(ev){
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

    function processPatchMsg(patchMsg)
    {
        var collabInfo = {};
        collabInfo.clname = patchMsg.clname;
        collabInfo.cp = patchMsg.cp;
        
        if(collabInfo.color === undefined)
        {
            collabInfo.color = getRandomColor();
        }

        var collabExists = collabCursors.filter(function(x){
            return x.clname === patchMsg.clname;
        })
        
        if( !(collabExists.length > 0) )
        {
            collabCursors.push(collabInfo);
            console.log("Collablist", collabCursors);
        }
        else
        {
            collabExists[0].cp = patchMsg.cp;
            delete collabInfo;
        }

 
        patchTextboxFromPatches(patchMsg.patches,patchMsg.cp);
    }

    function applyPendingPatches()
    {
        if(patchList.length > 0)
        {
            patchMsg = patchList.shift();
            processPatchMsg(patchMsg);

            timeoutPatch = setTimeout(applyPendingPatches, 100);
        }
            
    }


    function wsOnMessage(ev) { 
            
        const data = JSON.parse(ev.data);
        switch(data.msgCode)
        {
            case 1: // New patch and correpsonding collab cursor info
                {
                    processPatchMsg(data);
                    break;
                }

            case 2: //Sequence Number Reply for Delivery of Changed Text
                {
                    var seq = data.seq;
                    deliveredText = sentTextList[seq];
                    delete sentTextList[seq];
                    break;
                }

            case 3: //Remove a collaborator
                {
                    for(var x = 0; x < collabCursors.length; x++) 
                    {
                        if(collabCursors[x].clname === data.clname)
                        {
                            collabCursors.splice(x, 1);
                            break;
                        }
                    }
                    console.log("Removed collab", collabCursors);
                    break;
                }
            case 4: // On connection to server, assigned username.
                {
                    user.clname = data.clname;
                    user.color = "#000000";
                    if(!collabCursors.includes(user))
                    {
                        collabCursors.push(user);
                    }
                    document.getElementById("username").innerText = user.clname;
                    break;
                }


            default:
                {

                }
        }
       
    }
	
	

    function getRandomColor() 
    {
        var letters = '0123456789ABCDEF';
        var color = '#';
        for (var i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    function patchTextboxFromPatches(patches) {
        console.log(patches);
        textbox.disabled = true;

        const result = dmp.patch_apply(patches, textbox.value);
        let offset;
        const caretPosition = textbox.selectionEnd;
        lastUpdatedCopy = result[0];
        textbox.value = result[0];
        
        if(patches && (patches.length !== 0) )
        { 
            offset = getCaretOffset(patches, caretPosition);

            textbox.selectionStart = caretPosition + offset;
            textbox.selectionEnd = caretPosition + offset;
            // textbox.selectionStart += offset;
            // textbox.selectionEnd += offset;

        }

        generateHTMLFromText();

        textbox.disabled = false;
        textbox.focus();

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

    textbox.onclick = generateHTMLFromText;

    textbox.onpaste = generateHTMLFromText;

    textbox.onkeyup = function(e) {

        generateHTMLFromText();

        // if(timeoutPatch !== null)
        // {
        //     clearTimeout(timeoutPatch);
        //     timeoutPatch = setTimeout(applyPendingPatches, 500);
        // }

        if(timeoutSend === null)
        {
            timeoutSend = setTimeout(sendChanges, 1000);
        }
        else
        {
            clearTimeout(timeoutSend);
            timeoutSend = setTimeout(sendChanges, 1000); 
        }

        
    };

    textbox.onscroll = function(e) {
        textOverlay.scrollHeight = this.scrollHeight;
        textOverlay.scrollTop = this.scrollTop;
    }


    function generateHTMLFromText()
    {
        user.cp = textbox.selectionEnd;

        var text = textbox.value;
        
        textOverlay.innerHTML = '';

        // if(textbox.selectionEnd === 0)
        // {
        //     textOverlay.appendChild(caretSpan);
        // }

        var lineText = '';

        if(isCaretPos(0))
        {
            appendCarets(textOverlay, getCollabsAtPos(0));
        }


        for(var i = 0; i < text.length; i++)
        {
            var c = text.charAt(i);

            if( isNewLine(c) )
            {
                textOverlay.appendChild(document.createElement("br"));
            }
            else
            {
                lineText = getLineText(text, i);
                textOverlay.appendChild(document.createTextNode(lineText));
                if(lineText.length > 0)
                {
                    i += lineText.length - 1;
                }
            }

            if( isCaretPos(i + 1) )
            {
                console.log("here");
                appendCarets(textOverlay, getCollabsAtPos(i+1));
            }

        }

        if(text === '')
        {
            var placeholderTextNode = document.createElement("span");
            placeholderTextNode.appendChild(document.createTextNode("Write Here..."));
            placeholderTextNode.style.color = "grey";
            textOverlay.appendChild(placeholderTextNode);
        }

    }

    function isNewLine(c)
    {
        return (c === '\n');
    }

    function isCaretPos(i)
    {
        if( getCollabsAtPos(i).length > 0)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    function getCollabsAtPos(pos)
    {
        var collabsAtPos = [];

        for( var i = 0; i < collabCursors.length; i++ )
        {
            if(collabCursors[i].cp === pos)
            {
                collabsAtPos.push(collabCursors[i]);
            }
        }

        return collabsAtPos;
    }

    function appendCarets(parent, collabs)
    {
        var caretSpan;
        collabs.forEach(function(collab) {
            caretSpan = document.createElement('span');
            caretSpan.style.color = "white";
            caretSpan.style.borderColor = collab.color;
            caretSpan.classList.add("blink-cursor");
            caretSpan.classList.add("collab-cursor");

            parent.appendChild(caretSpan);

        })
        
        console.log("Collabs carets", collabs);
    }

    function getLineText(text, start)
    {
        var lineText = '';
        for(var i = start; i < text.length; i++)
        {
            if( isNewLine(text.charAt(i)) )
            {
                break;
            }

            if( isCaretPos(i + 1) )
            {
                lineText += text.charAt(i);
                break;
            }

            lineText += text.charAt(i);
        }

        return lineText;
    }


    function sendChanges() {

        
        // console.log(deliveredText !== textbox.value);
        
        if(ws.readyState === ws.OPEN && deliveredText !== textbox.value)
        {
            var seq = seqNo++;
            var text = textbox.value;
            var cp = textbox.selectionEnd;
            sentTextList[seq] = text; 
            var msg = {id, seq, text, cp}
            ws.send(JSON.stringify(msg));
            console.log("sending changes");
        }

    };


    wsConnect();

}