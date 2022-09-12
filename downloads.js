import { getPreference, saveDatatoStorage } from "./common.js";
window.addEventListener("load", init);
document.getElementById("trash").addEventListener("click", trashCheckedItems);
document.getElementById("reallyTrashAll").addEventListener("click", reallyTrashAll);
document.getElementById("trashAll").addEventListener("click", trashAllConfirm);
document.getElementById("cancelTrashAll").addEventListener("click", cancelTrashAll);
browser.runtime.onMessage.addListener(handleMessage);
document.getElementById("importlink").addEventListener("click",importDownloadData);
document.getElementById("exportlink").addEventListener("click",exportDownloadData);
document.getElementById("exportbutton").addEventListener("click",doExportDownloadData);
document.getElementById("importbutton").addEventListener("click",doImportDownloadData);
document.getElementById("cancelimportexport").addEventListener("click",cancelImportExport);


async function init() {
  let prunetype=parseInt(await(getPreference("DownloadLog")));
  if (prunetype == 2) {
    await pruneDownloadlist("Days");
  }
  if (prunetype == 4) {
    await pruneDownloadlist("Count");
  }
  await buildtable();
}

function handleMessage(request, sender) {
  if (request.greeting=="Append Downloads") {
    appendDownloadToTable(request.download);
  }
  if (request.greeting=="Update Downloads") {
    init();
  }
}

function trashAllConfirm() {
  document.getElementById("reallyTrashAllDiv").style.display="block";
  document.getElementById("trashAll").style.display="none";
}

function reallyTrashAll() {
  saveDatatoStorage("completedDownloads","[]");
  document.getElementById("reallyTrashAllDiv").style.display="none";
  document.getElementById("trashAll").style.display="block";
  buildtable();
}

function cancelTrashAll() {
  document.getElementById("reallyTrashAllDiv").style.display="none";
  document.getElementById("trashAll").style.display="block";
}

async function trashCheckedItems() {
  var preference=JSON.parse(await getPreference("completedDownloads"));

  let ptr=0;
  Array.from(document.querySelectorAll("input[type=\"checkbox\"]")).forEach(
    (elem => {
      if (elem.checked) {
        let tmp=preference.findIndex(item => item.id == elem.value);
        if (tmp > -1) {
          preference.splice(tmp,1);
          ptr++;
        }
      }
    }));
  if (ptr > 0) {
    saveDatatoStorage("completedDownloads",preference);
    buildtable();
  }
}

async function buildtable() {
  var preference=JSON.parse(await getPreference("completedDownloads"));
  let box=document.getElementById("downloadData");
  while (box.hasChildNodes()) {
    box.removeChild(box.lastChild);
  }
  if (preference.length == 0) {
    var tr=document.createElement("tr");
    tr.className="shade1";
    var td=document.createElement("td");
    td.colSpan=7;
    td.style.textAlign = "center";
    td.innerText="No Downloads yet";
    tr.appendChild(td);
    document.getElementById("downloadData").appendChild(tr);
    document.getElementById("trashAll").disabled=true;
  } else {
    document.getElementById("trashAll").disabled=false;
    var ptr=0;
    preference.forEach(line => {
      ptr++;
      appendDownloadToTable(line);
    });
  }
}

async function pruneDownloadlist(prunetype) {
  let downloads=JSON.parse(await getPreference("completedDownloads"));

  if (prunetype=="Days") {
    let period=await getPreference("downloadDays",7);
    if (period == null) { period=7; }
    let now=new Date();
    let tmp=new Date();
    tmp.setDate(now.getDate()-period)
    let timestamp=Date.parse(tmp);
    let ptr=0;
    while (ptr < downloads.length) {
      let dldate=downloads[ptr].dlend;
      if (dldate < timestamp) {
        downloads.splice(ptr,1);
      }
      else {
        ptr++;
      }
    }
  }
  if (prunetype=="Count") {
    const max=parseInt(await getPreference("DownloadCount",100));
    while (downloads.length > max) {
      downloads.splice(0,1);
    }
  }

  await saveDatatoStorage("completedDownloads",downloads);
}


function showImportExportdiv() {
  document.getElementById("footer").style.display="none";
  document.getElementById("importexportdiv").style.display="block";
  document.getElementById("downloadtable").style.display="none";
  document.getElementById("cancelimportexport").style.display="block";

}
function hideImportExportdiv() {
  document.getElementById("footer").style.display="grid";
  document.getElementById("importexportdiv").style.display="none";
  document.getElementById("downloadtable").style.display="block";
  document.getElementById("cancelimportexport").style.display="none";

  buildtable();
}


async function exportDownloadData() {
  showImportExportdiv();
  document.getElementById("exportbutton").style.display="block";
  document.getElementById("importbutton").style.display="none";
  let downloads=(await getPreference("completedDownloads"));
  document.getElementById("textarea").value=downloads;
}

function doExportDownloadData() {
   var blob = new Blob([document.getElementById("textarea").value], { type: "text/plain"});
    var anchor = document.createElement("a");
    anchor.download = "myanticontainer.log.txt";
    anchor.href = window.URL.createObjectURL(blob);
    anchor.target ="_blank";
    anchor.style.display = "none"; // just to be safe!
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    hideImportExportdiv();
}

async function doImportDownloadData() {
  try {
    let downloads=JSON.parse(document.getElementById("textarea").value);
    if (downloads.length > 0) {
      await saveDatatoStorage("completedDownloads",downloads);
      hideImportExportdiv();
    }
  } catch(e) {
    console.log(e); // error in the above string (in this case, yes)!
  }
}

function importDownloadData() {
  showImportExportdiv();
  document.getElementById("importbutton").style.display="block";
  document.getElementById("exportbutton").style.display="none";
}

function cancelImportExport() {
  hideImportExportdiv();
}

function appendDownloadToTable(line) {
  var ptr=document.getElementById("downloadData").rows.length + 1;
  var tr=document.createElement("tr");
  tr.className="shade"+(ptr % 2);
  tr.id="row"+ptr;
  for (var f = 0; f < 7; f++) {
    var td=document.createElement("td");
    switch (f) {
      case 0:
        td.className="wrap";
        td.innerText=line.referrer;
      break;
      case 1:
      case 2:
        var path="";
        var filename="";
        const x=line.filename.lastIndexOf("/");
        if (f==1) {
          if (x>0) {
            path=line.filename.substring(0,x);
          }
          td.innerText=path;
        }
        if (f==2) {
          filename=line.filename.substring(x+1,line.filename.length);
          td.innerText=filename;
        }
      break;
      case 3:
      case 4:
      case 5:
        var date;
        if (f==3) { date=new Date(line.dlstart); }
        if (f==4) { date=new Date(line.dlend);}
        if (f==5) { date=new Date(line.lastmod);}
        let datestr=(date.toLocaleDateString(browser.i18n.getUILanguage())+','+date.toLocaleTimeString(browser.i18n.getUILanguage()));
        td.innerText=datestr;
      break;
      case 6:
        var chkbox=document.createElement("INPUT");
        chkbox.setAttribute("type", "checkbox");
        chkbox.id="chkbox"+ptr;
        chkbox.value=line.id;
        td.style.textAlign = "center";
        td.appendChild(chkbox);
      break;
    }
    tr.appendChild(td);
  }
  document.getElementById("downloadData").appendChild(tr);
}

