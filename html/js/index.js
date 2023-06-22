function saveFile(blob, filename) {
    if (window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
      const a = document.createElement('a');
      document.body.appendChild(a);
      const url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      a.click();
    }
  }

// keys
function canSendKeys() {
    const confirm = document.getElementById("confirmKeys");
    if (checkbox1.checked && checkbox2.checked)
        confirm.removeAttribute('disabled')
    else
        confirm.setAttribute('disabled', true)
}

function generateKeys() {
    const keys = javalon.keypair();
    document.getElementById("pubKey").setAttribute("value", keys.pub);
    document.getElementById("privKey").setAttribute("value", keys.priv);
    console.log(keys);
}