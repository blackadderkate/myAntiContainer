// DEBUG flags
//  1      Functions
//  2      Database
//  4      Storage
//  8      Url
// 16      Filename
// 32      Gui
// 64      Downloading
//128      Container Parsing
var debuglevel = 0;

function loadDatafromStorage() {
  let data=browser.storage.local.get("AnticontainerData");
  return data;
}

function loadDatafromOldExtension() {
  var filename="./plugins/plugins.json";
  if (debuglevel > 0) { filename="./plugins/mytestdata.json"; }
  if ((debuglevel & 1) == 1) { console.log("FUNCTION loadDatafromOldExtension() START"); }
  if (((debuglevel & 2) == 2) || ((debuglevel & 4) == 4))  { console.log("No data in store. Loading old Anticontainer rules instead."); }
  fetch(filename)
  .then(function(response) {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
      }
   return response.text();
    })
  .then(function(response) {
    let data=JSON.parse(response);

    if(JSON.stringify(data) === '{}') {
      console.log("No data to load at all...");
    } else {
      if ((debuglevel & 4) == 4)  { console.log("Loaded "+data.length+" rules.");}
      data=sortAndParseLoadedData(data);
      if ((debuglevel & 4) == 4)  { console.log(data);}
      saveDatatoStorage("AnticontainerData",data);
      saveDatatoStorage("CachedData",data);
      if (document.title=="Settings Page") {
        buildHTMLOptionsList(data);
        document.getElementById("ruleslist").selectedIndex=0;
// Update the form buttons
        var event = new Event('change');
        document.getElementById("ruleslist").dispatchEvent(event);
      }
    }
  });
  if (debuglevel > 0) { console.log("FUNCTION loadDatafromOldExtension() EXIT"); }
}

function sortAndParseLoadedData(dataToSort) {
  if ((debuglevel & 1) == 1) { console.log("FUNCTION sortAndParseLoadedData() START"); }

  let sortedData=dataToSort.sort(function(a, b) {
        return a.prefix.localeCompare(b.prefix);
      });
  var ptr=0;
  sortedData.forEach((entry) => {
    entry.match=entry.match.replace(/http:/,"https?:");
    if (entry.priority==null) {
      entry.priority=1;
    }
    entry.ruleID=ptr;
    ptr++;
  });
  if ((debuglevel & 1) == 1) { console.log("FUNCTION sortAndParseLoadedData() EXIT"); }
  return sortedData;
}

function saveDatatoStorage(Key,dataToSave) {
 if ((debuglevel & 1) == 1)  { console.log("FUNCTION saveDatatoStorage("+Key+") START"); }
  if ((typeof dataToSave != undefined) && (dataToSave != null)) {
    if ((debuglevel & 4) == 4)  { console.log("Attempting to save data to local storage."); }
    let data=JSON.stringify(dataToSave);
    if (((debuglevel & 4) == 4) && (Key=="completedDownloads")) { console.log("Saving:"+JSON.parse(data).length+" records to "+Key); }
    if (((debuglevel & 4) == 4) && (Key!="completedDownloads")) { console.log("Saving:"+data+" to "+Key); }
    browser.storage.local.set({[Key]: data})
    .then(Success, onError);
  }
  function Success() {
    if ((debuglevel & 4) == 4) { console.log("Saved OK"); }
  }
  function onError(error) {
    console.log(error)
  }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION saveDatatoStorage("+Key+") EXIT"); }
}

async function loadDatafromCache() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION loadDatafromCache() START"); }
  var cachedData = await browser.storage.local.get("CachedData");
  var tmp=[];
  tmp=cachedData["CachedData"];
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION loadDatafromCache() EXIT"); }
  return tmp;
}


function buildHTMLOptionsList(data) {
  if ((debuglevel & 1) == 1) { console.log("FUNCTION buildHTMLOptionsList() START"); }
  var f=0;
  const list=document.getElementById("ruleslist");
  let tmp=data.sort(function(a, b) {
      return a.prefix.localeCompare(b.prefix);
    });
  tmp.forEach( elem => {
//    if ((elem.type == "resolver") || (elem.type == "redirector") || (elem.type == "sandbox")) {
    if ((elem.type == "resolver") || (elem.type == "redirector")) {
      var opt=document.getElementById("option_"+f);
      if ( opt == null) {
        var opt=document.createElement("option");
        opt.id="option_"+f;
        opt.textContent=elem.prefix;
        opt.value=elem.ruleID;
        list.appendChild(opt);
        if ((debuglevel & 32) == 32) { console.log("created Element "+opt.id+"="+elem.prefix); }
      }
      else {
        opt.textContent=elem.prefix;
      }
    }
    f++;
  });
  if ((debuglevel & 1) == 1) { console.log("FUNCTION buildHTMLOptionsList() EXIT"); }
}

async function getPreference(name,defaultVal) {
  let data = await browser.storage.local.get(name);
  if(JSON.stringify(data) === '{}') {
    data=defaultVal;}
  else {
    data=data[name];
  }
  return data;
}



function create_UUID(){
    var dt = new Date().getTime();
    var uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=="x" ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

async function getDownloadWindowId(tmp) {
  let id=-1;
  let debuglevel=tmp;
  if ((debuglevel & 32) == 32)  { console.log("Checking if Downloaded File History window is open.");}
  var popupWindows = await browser.windows.getAll({windowTypes: ["popup"], populate: true });
  if (popupWindows == null) {popupWindows = [];}
  if ((debuglevel & 32) == 32)  { console.log("Number of Popup Windows Open:"+popupWindows.length);}
  for (let f=0; f< popupWindows.length; f++) {
    if ((debuglevel & 32) == 32)  { console.log(popupWindows[f].tabs[0].title);}
    if (popupWindows[f].tabs[0].title == "Downloaded File History.") {
      id=popupWindows[f].id;
    }
  }
  if ((debuglevel & 32) == 32)  { console.log(id);}
  return id;
}

export { loadDatafromOldExtension, loadDatafromStorage, loadDatafromCache, saveDatatoStorage, buildHTMLOptionsList, getPreference, create_UUID, getDownloadWindowId };
