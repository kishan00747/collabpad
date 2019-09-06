var id = window.location.href.split("/").pop();
var host = window.location.host;

var inputPass = document.getElementById("input_pass");
var btnSubmit = document.getElementById("btn_submit");
var btnBack = document.getElementById("btn_back");
var modalMessage = document.getElementById("modal_message");

btnSubmit.onclick = onBtnSubmitClick;
btnBack.onclick = onBtnBackClick;

function onBtnSubmitClick(ev) {

    var data = {
        id,
        password: inputPass.value
    }


    fetch('https://' + host + '/notes/authenticate/', {
        method: 'POST',
        body: JSON.stringify(data),
        headers:{
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        
        if(data.reply === false)
        {
            modalMessage.innerText = "Password authentication failed!";
            modalMessage.style.display = "block";
        }
        else
        {
            console.log('h');
            window.location.replace('https://' + host + '/' + data.redirect);
        }
    });
}

function onBtnBackClick(ev) {
    window.location.assign("https://" + host);
}

