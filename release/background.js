'use strict'
import { loadDatafromOldExtension, loadDatafromCache, getPreference, saveDatatoStorage, create_UUID, getDownloadWindowId } from "./common.js";
import { MIMETYPES } from "./mimetypes.js";

// List of Download IDs in progress. Used to play sound when all downloads complete.
var downloadsInProgress = [];


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


function onInstalledNotification(details) {
  init();
}

function showSettings() {
  var openingPage = browser.runtime.openOptionsPage();
}

function init() {
  let gettingItem = browser.storage.local.get("AnticontainerData");
  gettingItem.then(onGot, onError);

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

  var tmp = {filename: "", LastModTime: 0};
  var sending = browser.runtime.sendNativeMessage('com.blackadderkate.anticontainerhelper',tmp);
  sending.then(onResponse, onError);
  init();

  if (browser.runtime.lastError) {
    console.log(`Error: ${browser.runtime.lastError}`);
  }
  else {
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
};

// Process AntiContainer Rules
function processRules(downloadObject) {
  var ruleNumber = 0;
  var loop = 0;
  downloadObject.referrer = downloadObject.url;
  do {
    loop++;
    var ruleNumber = CheckAntiContainerRules(downloadObject.url);
    if (loop > 999) {
      ruleNumber = -2;
      console.log("Error - infinite loop detected. Not proceeding.");
    }
    if (ruleNumber > -1) {
      var container = cachedData[ruleNumber];
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
              downloadObject.url = downloadObject.url.replace(RegExp(container.pattern,"g"),container.replacement);
            }
          }
        break;
        case "resolver":
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

    var finder = JSON.parse(this.finder);
    var builder = JSON.parse(this.builder);
    if (this.namer !=  null) {
      var namer = JSON.parse(this.namer);
    } else {
      var namer = "";
    }
    var dlObject = JSON.parse(this.dlObject);
    var url = dlObject.url;
    var blob = this.responseText;
    blob = blob.replace(/(\r\n)+|\r+|\n+|\t+/gm, "");
    var results = blob.match(RegExp(finder));
    if (results !=  null) {
      for (var f = 1; f<results.length; f++) {
        var builder = builder.replace("{"+f+"}",results[f]);
        var namer = namer.replace('{'+f+'}',results[f]);
      }
      if (builder.match(RegExp('^(?:[a-z]+:)?//', 'i')) == null) {
        builder = new URL(url).origin+builder;
      }
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
  }
}

// Sort rules by Priority
// loop through the rules, looking for a match
// if redirector, rewrite the URL
// if resolver, download the page, and analyse it in parseResolverData().
function CheckAntiContainerRules(url) {
  let sortedData = cachedData.sort(function(a, b) {
    return (b.priority - a.priority);
  });
  var match=0;
  for (var f = 0; f<sortedData.length; f++) {
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
  return index;
}

// Validate the URL and Filename
// do a HEAD request to sniff the download details.
// Parse the "Content-Type" to make sure the file extension is correct.
// Parse the "Last Modified" Header (if available)
// Parse the "content-disposition	attachment;  Header (if available) to get the filename.
function getHeaders(downloadObject) {
  if (isValidUrl(downloadObject.url)) {
    var oReq = new XMLHttpRequest();
    oReq.open("HEAD", downloadObject.url, true);
    oReq.send();
    oReq.onreadystatechange = function() {
      if (this.readyState == this.HEADERS_RECEIVED) {
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
}

function processCleaners(filename,cleaner) {
  let results = filename.match(cleaner.pattern);
  var newfilename = cleaner.replacement;
  if (results.length > 0) {
    for (var f = 1; f<results.length; f++) {
    newfilename = newfilename.replace('{'+f+'}',results[f]);
    }
  }
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

  if (hasUnicode(filename)) {
    filename = decodeURIComponent(filename);
  }

  filename = filename.replace(/&#(\d{1,3});/g, function(match, dec) { return String.fromCharCode(dec);});
  filename = filename.replace(/%([0-9a-f]{2})/gi, function(match, hex) { return String.fromCharCode(parseInt(match.substr(1,2),16));});
  filename = filename.replaceAll("+"," ");
  filename = filename.replaceAll("&quot;","\"");
  filename = filename.replace(/[/\\?%*:|<>]/gm, "_");


  const comma = mimetype.indexOf(";");
  if (comma > 0) {
    mimetype = mimetype.substr(0,comma);
  }
  var defaultExtension = MIMETYPES.m[mimetype];
  if (defaultExtension !=  null) {
// APPEND EXTENSION IF MISSING (TWITTER)
    var fileExtensionPos = filename.lastIndexOf(".");
    if (fileExtensionPos == -1) {
      filename += "." + defaultExtension;
    } else {
// REPLACE FILE EXTENSION IF WRONG.
      var extension = filename.substr(fileExtensionPos+1,filename.length);
      if (defaultExtension.indexOf(extension) == -1) {
        filename = filename.replace(extension,defaultExtension);
      }
    }
  }
  return filename;
}

// Get a default filename, if the server doesn't provide one in the headers
function extractFilenameFromURL(url) {
  var f = url.lastIndexOf("/");
  url = (f > -1 ) ? url.substring(f+1,url.length) : url;
  f = url.indexOf("?");
  var filename = (f > -1 ) ? url.substring(0,f) : url;

  filename = decodeURI(filename);


  return filename;
}

// Do the actual download.
// make sure we handle PHP "thumbnail" scripts
// by comparing the file extension with the MIME type
function doDownload(downloadObject) {
  var downloadOptions = {filename: downloadObject.filename, url: downloadObject.url, conflictAction : 'uniquify',saveAs: false, headers: []};
  if (browser == "Firefox") { downloadOptions.headers.push({ name: "Referer", value: downloadObject.referrer});}
    var downloading = browser.downloads.download(downloadOptions) ;
    downloading.then(onStartedDownload, onDownloadFailed);

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
  if (delta.state && ((delta.state.current === "complete") || (delta.state.current === "interrupted"))) {
    const MyDownload = downloadsInProgress.find(({id}) => id === delta.id);
    if (MyDownload != undefined ) {
      let now = new Date();
      MyDownload.dlend = Date.parse(now);
      const playsounds = await getPreference("playsounds","true");
      const notify = await getPreference("shownotification","true");
      const volume = await getPreference("volume",0.4);
      let tmp = downloadsInProgress.findIndex(item =>  item.id === delta.id);
      downloadsInProgress.splice(downloadsInProgress.findIndex(item =>  item.id === delta.id), 1)
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
    downloadObject.id = create_UUID();
    console.log("Successfully downloaded \""+downloadObject.url+"\" to \""+downloadObject.filename+"\".");
    var completedDownloads = []; // TO BE IMPLEMENTED
    let preference = JSON.parse(await getPreference("completedDownloads","{}"));
    if (JSON.stringify(preference).length <= 4) {
      completedDownloads = [downloadObject]; }
    else {
      completedDownloads = preference;
      completedDownloads.push(downloadObject);
    }
    saveDatatoStorage("completedDownloads",completedDownloads);
    let open=await getDownloadWindowId();
    if (open > -1) {
      var sending = browser.runtime.sendMessage({greeting: "Append Downloads",download: downloadObject});
      }
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

