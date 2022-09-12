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

var debuglevel=1;

async function init() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION init() START"); }
  let prunetype=parseInt(await(getPreference("DownloadLog")));
  if (prunetype == 2) {
    await pruneDownloadlist("Days");
  }
  if (prunetype == 4) {
    await pruneDownloadlist("Count");
  }
  await buildtable();
 if ((debuglevel & 1) == 1)  { console.log("FUNCTION init() EXIT"); }
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
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION reallyTrashAll() START"); }
  if ((debuglevel & 4) == 4)  { console.log("Clearing downloads from Storage"); }
  saveDatatoStorage("completedDownloads","[]");
  if ((debuglevel & 32) == 32)  { console.log("Hiding \"Clear Download Log\" confirmation dialog box."); }
  document.getElementById("reallyTrashAllDiv").style.display="none";
  document.getElementById("trashAll").style.display="block";
  if ((debuglevel & 32) == 32)  { console.log("Rebuild the list."); }
  buildtable();
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION reallyTrashAll() EXIT"); }
}

function cancelTrashAll() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION cancelTrashAll() START"); }
  if ((debuglevel & 32) == 32)  { console.log("Show \"Clear Download Log\" confirmation dialog box."); }
  document.getElementById("reallyTrashAllDiv").style.display="none";
  document.getElementById("trashAll").style.display="block";
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION cancelTrashAll() EXIT"); }
}

async function trashCheckedItems() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION trashCheckedItems() START"); }
  if ((debuglevel & 32) == 32) { console.log("Deleting checked items from Download History.");}
  var preference=JSON.parse(await getPreference("completedDownloads"));

  let ptr=0;
  Array.from(document.querySelectorAll("input[type=\"checkbox\"]")).forEach(
    (elem => {
      if (elem.checked) {
        let tmp=preference.findIndex(item => item.id == elem.value);
        if (tmp > -1) {
          if ((debuglevel & 4) == 4) { console.log("Deleting item "+tmp+" from Download History.");}
          preference.splice(tmp,1);
          ptr++;
        }
      }
    }));
  if (ptr > 0) {
    saveDatatoStorage("completedDownloads",preference);
    buildtable();
  }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION trashCheckedItems() EXIT"); }
}

async function buildtable() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION buildtable() START"); }
  var preference=JSON.parse(await getPreference("completedDownloads"));
  let box=document.getElementById("downloadData");
  if ((debuglevel & 32) == 32) { console.log("Clearing Table");}
  while (box.hasChildNodes()) {
    box.removeChild(box.lastChild);
  }
  if ((debuglevel & 32) == 32) { console.log("Rebuilding Table");}
  if (preference.length == 0) {
    if ((debuglevel & 32) == 32) { console.log("No downloads yet. Display a helpful message.");}
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
      if ((debuglevel & 32) == 32) { console.log("Adding Download ["+ptr+'] of '+preference.length+" to table.");}
      appendDownloadToTable(line);
    });
  }
  if ((debuglevel & 32) == 32) { console.log("Table updated.");}
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION buildtable() EXIT"); }
}

async function pruneDownloadlist(prunetype) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION pruneDownloadlist() START"); }
  let downloads=JSON.parse(await getPreference("completedDownloads"));
  if ((debuglevel & 512) == 512)  { console.log("Loaded "+downloads.length+" completedDownloads records from Storage.");}

  if (prunetype=="Days") {
    let period=await getPreference("downloadDays",7);
    if (period == null) { period=7; }
    if ((debuglevel & 4) == 4)  { console.log("Delete records after "+period+" day(s).");}
    let now=new Date();
    let tmp=new Date();
    tmp.setDate(now.getDate()-period)
    if ((debuglevel & 512) == 512)  {
      var lang = browser.i18n.getUILanguage(); //debuglevel
      console.log("Deleting records earlier than:"+tmp.toLocaleDateString(lang)+','+tmp.toLocaleTimeString(lang)+".");} //debuglevel
    let timestamp=Date.parse(tmp);
    let ptr=0;
    while (ptr < downloads.length) {
      let dldate=downloads[ptr].dlend;
      if (dldate < timestamp) {
        if ((debuglevel & 512) == 512)  {
          let lang = browser.i18n.getUILanguage(); //debuglevel
          let date=new Date(dldate); //debuglevel
          console.log("Deleting: "+downloads[ptr].filename+", downloaded on:"+date.toLocaleDateString(lang)+' @ '+date.toLocaleTimeString(lang));  //debuglevel
        } //debuglevel
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
      if ((debuglevel & 512) == 512)  {
        let lang = browser.i18n.getUILanguage(); //debuglevel
        let date=new Date(downloads[0].dlend); //debuglevel
        console.log("Deleting: "+downloads[0].filename+", downloaded on:"+date.toLocaleDateString(lang)+' @ '+date.toLocaleTimeString(lang)); //debuglevel
      } //debuglevel
      downloads.splice(0,1);
    }
  }

  if ((debuglevel & 512) == 512)  {  console.log("Saving "+downloads.length+" completedDownloads records to Storage.");}
  await saveDatatoStorage("completedDownloads",downloads);
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION pruneDownloadlist() EXIT"); }
}


function showImportExportdiv() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION showImportExportdiv() START"); }
  document.getElementById("footer").style.display="none";
  document.getElementById("importexportdiv").style.display="block";
  document.getElementById("downloadtable").style.display="none";
  document.getElementById("cancelimportexport").style.display="block";

  if ((debuglevel & 1) == 1)  { console.log("FUNCTION showImportExportdiv() EXIT"); }
}
function hideImportExportdiv() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION hideImportExportdiv() START"); }
  document.getElementById("footer").style.display="grid";
  document.getElementById("importexportdiv").style.display="none";
  document.getElementById("downloadtable").style.display="block";
  document.getElementById("cancelimportexport").style.display="none";

  if ((debuglevel & 1) == 1)  { console.log("FUNCTION hideImportExportdiv() EXIT"); }
  buildtable();
}


async function exportDownloadData() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION exportDownloadData() START"); }
  showImportExportdiv();
  document.getElementById("exportbutton").style.display="block";
  document.getElementById("importbutton").style.display="none";
  let downloads=(await getPreference("completedDownloads"));
  document.getElementById("textarea").value=downloads;
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION exportDownloadData() EXIT"); }
}

function doExportDownloadData() {
   if ((debuglevel & 1) == 1)  { console.log("FUNCTION doExportDownloadData() START"); }
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
   if ((debuglevel & 1) == 1)  { console.log("FUNCTION doExportDownloadData() EXIT"); }
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
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION importDownloadData() START"); }
  showImportExportdiv();
  document.getElementById("importbutton").style.display="block";
  document.getElementById("exportbutton").style.display="none";
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION importDownloadData() EXIT"); }
}

function cancelImportExport() {
  hideImportExportdiv();
}

function appendDownloadToTable(line) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION appendDownloadToTable() START"); }
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
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION appendDownloadToTable() EXIT"); }
}

