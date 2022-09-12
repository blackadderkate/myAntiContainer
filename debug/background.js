'use strict'
import { loadDatafromOldExtension, loadDatafromCache, getPreference, saveDatatoStorage, create_UUID, getDownloadWindowId } from "./common.js";
import { MIMETYPES } from "./mimetypes.js";

// List of Download IDs in progress. Used to play sound when all downloads complete.
var downloadsInProgress = [];

var debuglevel=1+64;

// Download completion sound.
var audio = document.getElementById("myAudio");

var cachedData = [];

var AntiContainerHelperInstalled = false;

function myDownloadObject(id, url, filename, referrer, mimetype, cleaners, lastmod, dlstart, dlend) {
  this.id = id;
  this.url = url;
  this.filename = filename;
  this.referrer = referrer;
  this.mimetype = mimetype;
  this.cleaners = cleaners;
  this.lastmod = lastmod;
  this.dlstart = dlstart;
  this.dlend = dlend;
}

var counter = 0;

var browsername="Chrome";
try {
  var gettingInfo = await browser.runtime.getBrowserInfo();
  browsername=gettingInfo.name;
}
catch(err) {
}

if (browsername == "Chrome") {
  browser.contextMenus.onClicked.addListener(onMenuClicked);
}
else {
  browser.menus.onClicked.addListener(onMenuClicked);
  browser.menus.onShown.addListener(async function() {cachedData = JSON.parse(await loadDatafromCache());});
}
browser.downloads.onChanged.addListener(downloadHandleChanged);
browser.alarms.onAlarm.addListener(handleAlarm);
browser.browserAction.onClicked.addListener(showSettings);
browser.runtime.onInstalled.addListener(onInstalledNotification);

if ((debuglevel & 4) == 4)  { browser.storage.onChanged.addListener(logStorageChange); }

function onInstalledNotification(details) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION onInstalledNotification() START"); }
  init();
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION onInstalledNotification() EXIT"); }
}

function showSettings() {
  var openingPage = browser.runtime.openOptionsPage();
}

function init() {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION init() START"); }
  let gettingItem = browser.storage.local.get("AnticontainerData");
  gettingItem.then(onGot, onError);
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION init() EXIT"); }

  function onGot(data) {
    if(JSON.stringify(data) === '{}') {
      console.log("First Run.");
      loadDatafromOldExtension();
    }
  }
  function onError(data) {
    console.log("Error is: ${error}");
  }
}

///////////////////
// CONTEXT MENUS //
///////////////////

// Create a context menu
let options={
   id: "blackadderkateMenu",
   title: "Quick D&ownload",
  contexts: ["image","link","selection"]
};

if (browsername=="Firefox") {
  options.icons= {
     "16": "icons/page_save_16x16.png",
     "32": "icons/page_save_32x32.png"
   }
  browser.menus.create(options, onMenuCreated);
}
else {
  browser.contextMenus.create(options, onMenuCreated);
}
// Menu clicked - begin the download process

function onMenuCreated() {
//  console.clear();
// preload audio by playing it just once, but really quietly.
  audio.volume = 0.20;
  audio.muted = true;
  audio.addEventListener("canplaythrough", () => audio.play());
  audio.play();
  browser.menus.update("blackadderkateMenu", {title: browser.i18n.getMessage("blackadderkateMenu")});
  if (debuglevel > 0) { let now = new Date(); console.log("Extension Loaded:"+now); }
  if (debuglevel > 0) { console.log("debug level = "+debuglevel); }

  var tmp = {filename: "", LastModTime: 0};
  var sending = browser.runtime.sendNativeMessage('com.blackadderkate.anticontainerhelper',tmp);
  sending.then(onResponse, onError);
  init();

  if (browser.runtime.lastError) {
    console.log(`Error: ${browser.runtime.lastError}`);
  }
  else {
    if ((debuglevel & 32) == 32)  { console.log("Menu Item created successfully."); }
  }

  function onResponse(response) {
    if (response == "OK") {
      AntiContainerHelperInstalled = true;
    }
  }
  function onError(error) {
    console.log(`Error is: ${error}`);
    AntiContainerHelperInstalled = false;
  }
}

async function onMenuClicked(info, tab) {
  if (info.menuItemId = "blackadderkateMenu") {
    if (browsername=="Chrome") {
      cachedData = JSON.parse(await loadDatafromCache()); }
    let now = new Date();
    if ((debuglevel & 1) == 1) { console.log("FUNCTION onClicked START."); }
    if (typeof(info.selectionText) !== "undefined") {
      const text1 = JSON.parse(await(browser.tabs.executeScript(tab.id,{
        file: "selection.js"
      })));
      text1.forEach( elem => {
        var downloadObject = new myDownloadObject;
        downloadObject.id = counter++;
        downloadObject.lastmod = 0;
        downloadObject.referrer = "";
        downloadObject.filename = "";
        downloadObject.mimetype = "";
        downloadObject.cleaners = "";
        downloadObject.dlstart = Date.parse(now);
        downloadObject.dlend = 0;
        downloadObject.url=elem;
        processRules(downloadObject);
    });
  }
  else {
    var downloadObject = new myDownloadObject;
    downloadObject.id = counter++;
    downloadObject.lastmod = 0;
    downloadObject.referrer = "";
    downloadObject.filename = "";
    downloadObject.mimetype = "";
    downloadObject.cleaners = "";
    downloadObject.dlstart = Date.parse(now);
    downloadObject.dlend = 0;
    if (info.linkUrl !=  null) {
      downloadObject.url = info.linkUrl;
    } else if (info.srcUrl !=  null) {
      downloadObject.url = info.srcUrl;
    }
    if (downloadObject.url !=  "") {
        processRules(downloadObject);
      }
    }
  }
  if ((debuglevel & 1) == 1) { console.log("FUNCTION onClicked END"); }
};

// Process AntiContainer Rules
function processRules(downloadObject) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION processRules START."); }
  if ((debuglevel & 8) == 8) { console.log("Initial URL = "+downloadObject.url); }
  var ruleNumber = 0;
  var loop = 0;
  downloadObject.referrer = downloadObject.url;
  do {
    loop++;
    if ((debuglevel & 128) == 128)  { console.log("LOOP COUNT:"+loop);}
    if ((debuglevel & 128) == 128)  { console.log("Checking URL \""+downloadObject.url+"\" in AntiContainerRules."); }
    var ruleNumber = CheckAntiContainerRules(downloadObject.url);
    if (loop > 999) {
      ruleNumber = -2;
      console.log("Error - infinite loop detected. Not proceeding.");
    }
    if (ruleNumber > -1) {
      var container = cachedData[ruleNumber];
      if ((debuglevel & 128) == 128)  { console.log("Rule "+ruleNumber+" ("+container.prefix+") matched, which is a "+container.type+"."); }
      if (container.omitReferrer == true) { downloadObject.referrer = ""; }
      if (container.keepReferrer == true) { downloadObject.referrer = tab.url; }
      if (container.cleaners !=  null) {
        if (container.cleaners.length > 0) {
          downloadObject.cleaners = container.cleaners;
        }
      }
      switch (container.type) {
        case "redirector":
          if (container.pattern !=  null) {
            var results = downloadObject.url.match(container.pattern);
            if (results != null) {
              if ((debuglevel & 128) == 128)  { console.log("Pattern Matches! Returned Data = "+results); }
              downloadObject.url = downloadObject.url.replace(RegExp(container.pattern,"g"),container.replacement);
              if (((debuglevel & 128) == 128) || ((debuglevel & 8) == 8)){ console.log("Redirected URL = "+downloadObject.url); }
            }
          }
        break;
        case "resolver":
          if ((debuglevel & 128) == 128) { console.log("Fetching URL:"+downloadObject.url+" for processing."); }
          var oReq = new XMLHttpRequest();
          oReq.addEventListener("load", parseResolverData);
          oReq.finder = JSON.stringify(container.finder);
          oReq.builder = JSON.stringify(container.builder);
          oReq.namer = JSON.stringify(container.namer);
          oReq.dlObject = JSON.stringify(downloadObject);
          oReq.open("GET", downloadObject.url, true);
          oReq.send();
          ruleNumber = -2;
        break;
      }
    }
  }
  while (ruleNumber > -1);
  if (ruleNumber != -2) { getHeaders(downloadObject); }

// We have successfully downloaded a webpage into blob.responseText
// Process the FINDER, BUILDER and NAMER
// and store the results in dlObject
// Then pass the new dlObject to the next stage (ProcessHeaders).
  async function parseResolverData() {
    if ((debuglevel & 1) == 1)  { console.log("FUNCTION parseResolverData START"); }

    var finder = JSON.parse(this.finder);
    var builder = JSON.parse(this.builder);
    if (this.namer !=  null) {
      var namer = JSON.parse(this.namer);
    } else {
      var namer = "";
    }
    var dlObject = JSON.parse(this.dlObject);
    var url = dlObject.url;
    if ((debuglevel & 128) == 128) { console.log("URL \""+url+"\" downloaded successfully - preparing to process resolver..."); }
    var blob = this.responseText;
    blob = blob.replace(/(\r\n)+|\r+|\n+|\t+/gm, "");
    var results = blob.match(RegExp(finder));
    if (results !=  null) {
    if ((debuglevel & 128) == 128)  { console.log("Results = "+JSON.stringify(results));}
      for (var f = 1; f<results.length; f++) {
        if ((debuglevel & 128) == 128)  { console.log("BUILDER = "+builder);}
        if ((debuglevel & 128) == 128) { console.log("replacing \"{"+f+"}\" in BUILDER with \""+results[f]+"\" if required.");}
        var builder = builder.replace("{"+f+"}",results[f]);
        if ((debuglevel & 128) == 128)  { console.log("NAMER = "+namer);}
        if ((debuglevel & 128) == 128)  { console.log("replacing \"{"+f+"}\" in NAMER with \""+results[f]+"\" if required.");}
        var namer = namer.replace('{'+f+'}',results[f]);
      }
      if (builder.match(RegExp('^(?:[a-z]+:)?//', 'i')) == null) {
        if (((debuglevel & 128) == 128) || ((debuglevel & 8) == 8))  { console.log("URL has no \"origin\". Adding it now."); }
        builder = new URL(url).origin+builder;
      }
      if ((debuglevel & 128) == 128) { console.log("Resolver processed. builder = \""+builder+"\", namer = \""+namer+"\"."); }
      dlObject.url = builder;
      dlObject.filename = namer;
      getHeaders(dlObject);
    } else {
      console.log("Resolver error - the Finder pattern could not be found.");
      const notify = await getPreference("shownotification","true");
      if (notify == "true") {
        let options={
          "type": "basic",
          "title": "Error",
          "message": "Resolver error - the Finder pattern could not be found."
        };
        let delayInMinutes = (1/10);
        if (browsername=="Chrome") {
          const delayInMinutes = 1;
          options.iconUrl="icons/accept.png";
        }
        browser.notifications.create("AnticontainerNotification", options);
        browser.alarms.create("AnticontainerNotification",{delayInMinutes});
      }
    }
    if ((debuglevel & 1) == 1) { console.log("FUNCTION parseResolverData EXIT"); }
  }
}

// Sort rules by Priority
// loop through the rules, looking for a match
// if redirector, rewrite the URL
// if resolver, download the page, and analyse it in parseResolverData().
function CheckAntiContainerRules(url) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION CheckAntiContainerRules() START"); }
  let sortedData = cachedData.sort(function(a, b) {
    return (b.priority - a.priority);
  });
  var match=0;
  for (var f = 0; f<sortedData.length; f++) {
    if ((debuglevel & 128) == 128) { console.log("Checking rule "+f+" ("+sortedData[f].prefix+")"+sortedData[f].priority); }
    if (sortedData[f].prefix.length > 0) {
      match = url.search(RegExp(sortedData[f].match));
    } else {
      match = -1;
    }
    if (match > -1) { break; }
  }

  var index = -1;

  if (f < sortedData.length) {
    index = cachedData.findIndex((element) =>  element.prefix == sortedData[f].prefix);
  }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION CheckAntiContainerRules() EXIT"); }
  return index;
}

// Validate the URL and Filename
// do a HEAD request to sniff the download details.
// Parse the "Content-Type" to make sure the file extension is correct.
// Parse the "Last Modified" Header (if available)
// Parse the "content-disposition	attachment;  Header (if available) to get the filename.
function getHeaders(downloadObject) {
  if ((debuglevel & 1) == 1) { console.log("FUNCTION getHeaders START"); }
  if (isValidUrl(downloadObject.url)) {
    if ((debuglevel & 64) == 64) { console.log("Performing final checks (MimeType validation and URL Exists etc.)."); }
    var oReq = new XMLHttpRequest();
    oReq.open("HEAD", downloadObject.url, true);
    oReq.send();
    oReq.onreadystatechange = function() {
      if (this.readyState == this.HEADERS_RECEIVED) {
      if ((debuglevel & 64) == 64) { console.log(oReq.status);}
      if ((debuglevel & 64) == 64) { console.log(oReq.getAllResponseHeaders());}
        if ((oReq.getResponseHeader('Content-Type').length > 0) && (downloadObject.mimetype.length == 0) && (oReq.status >= 200) && (oReq.status <= 299)) {
        downloadObject.mimetype = oReq.getResponseHeader('Content-Type');}
        if (downloadObject.lastmod == 0) {
          if (oReq.getResponseHeader('Last-Modified') != null)  {
            downloadObject.lastmod = Date.parse(oReq.getResponseHeader('Last-Modified'));
          } else {
            downloadObject.lastmod = Math.floor(Date.now() / 1000) * 1000;
          }
        }
        if (oReq.getResponseHeader('Content-Disposition') !=  null) {
          let header = oReq.getResponseHeader('Content-Disposition');
          let p1 = header.toLowerCase().indexOf("filename*=utf-8''");
          if (p1>0) {
            p1 = p1+17;
            let p2 = header.length-p1;
            downloadObject.filename = decodeURIComponent(header.substr(p1,p2));
          } else {
            downloadObject.filename = header.match(/filename=\"(.+)\"/)[1];
          }
        }
      }
      if (oReq.readyState == 4) {
        if (downloadObject.filename.length == 0) {  downloadObject.filename = extractFilenameFromURL(downloadObject.url);}
        if ((debuglevel & 64) == 64) { console.log(downloadObject); }
        if (downloadObject.cleaners != "") {
          downloadObject.cleaners.forEach(elem =>  {
            downloadObject.filename = processCleaners(downloadObject.filename,elem);
            });
        }
        downloadObject.filename = validateFilename(downloadObject.filename,downloadObject.mimetype);
        doDownload(downloadObject);
      }
    }
  }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION getHeaders EXIT"); }
}

function processCleaners(filename,cleaner) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION processCleaners START"); }
  let results = filename.match(cleaner.pattern);
  var newfilename = cleaner.replacement;
  if (results.length > 0) {
    for (var f = 1; f<results.length; f++) {
    if ((debuglevel & 128) == 128)  { console.log("CLEANER = "+newfilename);}
    if ((debuglevel & 128) == 128) { console.log("replacing \"{"+f+"}\" in REPLACEMENT with \""+results[f]+"\" if required.");}
    newfilename = newfilename.replace('{'+f+'}',results[f]);
    }
  }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION processCleaners EXIT"); }
  return newfilename;
}

function isValidUrl(url) {
  return RegExp("^(https?|ftp):\/\/(localhost|(.*\.[a-zA-Z- = 0]{2,30}))\/.*").test(url);
}

function hasUnicode(s) {
    return /[^\u0000-\u007f]/.test(s);
}

// remove invalid characters from filename
// check for File Extension <--> MimeType mismatch
function validateFilename(filename,mimetype) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION validateFilename() START"); }
  if ((debuglevel & 16) == 16) { console.log("Filename is:"+filename);}

  if (hasUnicode(filename)) {
    if ((debuglevel & 16) == 16) { console.log("Parsing Unicode entities.");}
    filename = decodeURIComponent(filename);
    if ((debuglevel & 16) == 16) { console.log("Filename is now:"+filename);}
  }

  if ((debuglevel & 16) == 16) { console.log("Parsing HTML Entities.");}
  filename = filename.replace(/&#(\d{1,3});/g, function(match, dec) { return String.fromCharCode(dec);});
  filename = filename.replace(/%([0-9a-f]{2})/gi, function(match, hex) { return String.fromCharCode(parseInt(match.substr(1,2),16));});
  filename = filename.replaceAll("+"," ");
  filename = filename.replaceAll("&quot;","\"");
  if ((debuglevel & 16) == 16) { console.log("Filename is now:"+filename);}
  if ((debuglevel & 16) == 16) { console.log("Replacing invalid characters.");}
  filename = filename.replace(/[/\\?%*:|<>]/gm, "_");
  if ((debuglevel & 16) == 16) { console.log("Filename is now:"+filename);}

  if ((debuglevel & 16) == 16) { console.log("Checking File Extension.");}

  const comma = mimetype.indexOf(";");
  if (comma > 0) {
    mimetype = mimetype.substr(0,comma);
  }
  var defaultExtension = MIMETYPES.m[mimetype];
  if (defaultExtension !=  null) {
// APPEND EXTENSION IF MISSING (TWITTER)
    var fileExtensionPos = filename.lastIndexOf(".");
    if (fileExtensionPos == -1) {
      if ((debuglevel & 16) == 16) { console.log("The Filename \""+filename+"\" has no extension. Appending \"."+defaultExtension+"\"."); }
      filename += "." + defaultExtension;
    } else {
    if ((debuglevel & 16) == 16) { console.log("Filename is now:"+filename);}
// REPLACE FILE EXTENSION IF WRONG.
      var extension = filename.substr(fileExtensionPos+1,filename.length);
      if (defaultExtension.indexOf(extension) == -1) {
        if ((debuglevel & 16) == 16) { console.log("The Extension (\""+extension+"\") does not match Mime Type sent by the server (\""+mimetype+"\"). Changing it to "+defaultExtension+".");}
        filename = filename.replace(extension,defaultExtension);
        if ((debuglevel & 16) == 16) { console.log("Filename is now  = "+filename);}
      }
    }
  }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION validateFilename() EXIT"); }
  return filename;
}

// Get a default filename, if the server doesn't provide one in the headers
function extractFilenameFromURL(url) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION extractFilenameFromURL START"); }
  if ((debuglevel & 16) == 16) { console.log("Extracting Filename from:"+url); }
  if ((debuglevel & 16) == 16) { console.log("Filename = "+url); }
  var f = url.lastIndexOf("/");
  url = (f > -1 ) ? url.substring(f+1,url.length) : url;
  if ((debuglevel & 16) == 16) { console.log("STEP 1: Extracted text after the trailing slash = "+url); }
  f = url.indexOf("?");
  var filename = (f > -1 ) ? url.substring(0,f) : url;
  if ((debuglevel & 16) == 16) { console.log("STEP 2: Truncated any GET Query text."); }
  if ((debuglevel & 16) == 16) { console.log("Filename = "+url); }

  filename = decodeURI(filename);

  if ((debuglevel & 16) == 16) { console.log("STEP 3: URI_Decoded = "+filename); }
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION extractFilenameFromURL EXIT"); }

  return filename;
}

// Do the actual download.
// make sure we handle PHP "thumbnail" scripts
// by comparing the file extension with the MIME type
function doDownload(downloadObject) {
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION doDownload START"); }
  if ((debuglevel & 64) == 64) { console.log("Downloading \""+downloadObject.url+"\" to \""+downloadObject.filename+"\"");}
  var downloadOptions = {filename: downloadObject.filename, url: downloadObject.url, conflictAction : 'uniquify',saveAs: false, headers: []};
  if (browser == "Firefox") { downloadOptions.headers.push({ name: "Referer", value: downloadObject.referrer});}
  if ((debuglevel & 64) == 64) { console.log("Referrer:" + downloadObject.referrer); }
  if ((debuglevel & 64) == 64) { console.log("Downloads in Progress:" + downloadsInProgress.length); }
  if (debuglevel < 999) {
    var downloading = browser.downloads.download(downloadOptions) ;
    downloading.then(onStartedDownload, onDownloadFailed);
  } //debuglevel
  if ((debuglevel & 1) == 1)  { console.log("FUNCTION doDownload EXIT"); }

  function onStartedDownload(id) {
    downloadObject.id = id;
    downloadsInProgress.push(downloadObject);
  }
  function onDownloadFailed(error) {
    console.log(`Error: ${error}`);
  }
}

// Post Download Routines

// Check if our Download has completed.
// Play Sound and show notifications, if preferences set - but only for OUR downloads!
// Finally get the actual filename as saved to disk from DownloadManager.
// And send a message to our AntiContainerHelper app to change the modification date.
async function downloadHandleChanged(delta) {
  if ((debuglevel & 64) == 64) { console.log("+++++++++++++++++++++++++++++++++++++++++");}
  if ((debuglevel & 64) == 64) { console.log(delta);}
  if (delta.state && ((delta.state.current === "complete") || (delta.state.current === "interrupted"))) {
    const MyDownload = downloadsInProgress.find(({id}) => id === delta.id);
    if (MyDownload != undefined ) {
      let now = new Date();
      MyDownload.dlend = Date.parse(now);
      const playsounds = await getPreference("playsounds","true");
      const notify = await getPreference("shownotification","true");
      const volume = await getPreference("volume",0.4);
      let tmp = downloadsInProgress.findIndex(item =>  item.id === delta.id);
      if ((debuglevel & 64) == 64) { console.log("Removing Entry ["+tmp+"] from DownloadsInProgress");}
      downloadsInProgress.splice(downloadsInProgress.findIndex(item =>  item.id === delta.id), 1)
      if ((debuglevel & 64) == 64) { console.log("Downloads still in progress:"+downloadsInProgress.length); }
        if (downloadsInProgress.length == 0) {
        if (playsounds == "true") {
          audio.volume = volume;
          audio.muted = false;
          audio.play();
        }
        if (notify == "true") {
          let options={
            "type": "basic",
            "title": "All Done!",
            "message": "All AntiContainer Downloads complete!"
          };
          let delayInMinutes = (1/10);
          if (browsername=="Chrome") {
            const delayInMinutes = 1;
            options.iconUrl="icons/accept.png";
          }
          browser.notifications.create("AnticontainerNotification", options);
          browser.alarms.create("AnticontainerNotification",{delayInMinutes});
        }
      }
      if ((delta.state.current === "complete")) {
        var downloaddetails = await browser.downloads.search({id: delta.id});
        let tmp = {filename: encodeURIComponent(downloaddetails[0].filename), LastModTime: MyDownload.lastmod};
        MyDownload.filename = downloaddetails[0].filename;
        if ((MyDownload.lastmod > 0) && (AntiContainerHelperInstalled === true)) {
          var sending = browser.runtime.sendNativeMessage("com.blackadderkate.anticontainerhelper",tmp);
           sending.then(onResponse.bind(null, MyDownload), logDownloadError);
        } else {
          saveDownloadLog(MyDownload);
        }
      }
    }
  }
  async function onResponse(downloadObject,message) {
    let tmp = message.match(RegExp("Renamed \"(.+)\" to \"(.+)\"\."));
    if (tmp !=  null) {
      downloadObject.filename = tmp[2];
    }
    saveDownloadLog(downloadObject);
  }
  function logDownloadError(error) {
    console.log(`Error: ${error}`);
  }
  async function saveDownloadLog(downloadObject) {
    if ((debuglevel & 1) == 1)  { console.log("FUNCTION saveDownloadLog START"); }
    downloadObject.id = create_UUID();
    console.log("Successfully downloaded \""+downloadObject.url+"\" to \""+downloadObject.filename+"\".");
    var completedDownloads = []; // TO BE IMPLEMENTED
    let preference = JSON.parse(await getPreference("completedDownloads","{}"));
    if ((debuglevel & 4) == 4)  { console.log("Getting Download List from Storage.");}
    if (JSON.stringify(preference).length <= 4) {
      completedDownloads = [downloadObject]; }
    else {
      completedDownloads = preference;
      if ((debuglevel & 4) == 4)  { console.log("Appending "+downloadObject.filename+" to Download List.");}
      completedDownloads.push(downloadObject);
    }
    if ((debuglevel & 4) == 4)  { console.log("Saving Download List to Storage.");}
    saveDatatoStorage("completedDownloads",completedDownloads);
    if ((debuglevel & 32) == 32)  { console.log("Checking if Downloaded File History window (is open).");}
    let open=await getDownloadWindowId(debuglevel);
//RELEASE     let open=await getDownloadWindowId();
    if (open > -1) {
      if ((debuglevel & 32) == 32)  { console.log("Downloaded File History window is open.\nSend it a message, asking it to refresh.");}
      var sending = browser.runtime.sendMessage({greeting: "Append Downloads",download: downloadObject});
      }
    if ((debuglevel & 1) == 1)  { console.log("FUNCTION saveDownloadLog EXIT"); }
  }
}


function handleAlarm(alarmInfo) {
  browser.notifications.clear(alarmInfo.name);
}


function logStorageChange(changes, area) {
  let changedItems = Object.keys(changes);

  for (let item of changedItems) {
    console.log(item + " has changed:");
    console.log("Old value: " + JSON.parse(changes[item].oldValue).length);
    console.log("New value: " + JSON.parse(changes[item].newValue).length);
  }
}

