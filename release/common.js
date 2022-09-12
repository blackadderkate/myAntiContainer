// DEBUG flags
//  1      Functions
//  2      Database
//  4      Storage
//  8      Url
// 16      Filename
// 32      Gui
// 64      Downloading
//128      Container Parsing

function loadDatafromStorage() {
  let data=browser.storage.local.get("AnticontainerData");
  return data;
}

function loadDatafromOldExtension() {
  var filename="./plugins/plugins.json";
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
      data=sortAndParseLoadedData(data);
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
}

function sortAndParseLoadedData(dataToSort) {

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
  return sortedData;
}

function saveDatatoStorage(Key,dataToSave) {
  if ((typeof dataToSave != undefined) && (dataToSave != null)) {
    let data=JSON.stringify(dataToSave);
    browser.storage.local.set({[Key]: data})
    .then(Success, onError);
  }
  function Success() {
  }
  function onError(error) {
    console.log(error)
  }
}

async function loadDatafromCache() {
  var cachedData = await browser.storage.local.get("CachedData");
  var tmp=[];
  tmp=cachedData["CachedData"];
  return tmp;
}


function buildHTMLOptionsList(data) {
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
      }
      else {
        opt.textContent=elem.prefix;
      }
    }
    f++;
  });
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
  var popupWindows = await browser.windows.getAll({windowTypes: ["popup"], populate: true });
  if (popupWindows == null) {popupWindows = [];}
  for (let f=0; f< popupWindows.length; f++) {
    if (popupWindows[f].tabs[0].title == "Downloaded File History.") {
      id=popupWindows[f].id;
    }
  }
  return id;
}

export { loadDatafromOldExtension, loadDatafromStorage, loadDatafromCache, saveDatatoStorage, buildHTMLOptionsList, getPreference, create_UUID, getDownloadWindowId };
