
// ADD Listeners to buttons

import { loadDatafromOldExtension, loadDatafromCache, loadDatafromStorage, saveDatatoStorage, buildHTMLOptionsList, getPreference, getDownloadWindowId } from "./common.js";
var cachedData = [];
document.getElementById("loadFromStorageButton").addEventListener("click", reloadDatafromStorage);
document.getElementById("loadFromExtensionButton").addEventListener("click", reloadDatafromOldExtension);
document.getElementById("saveToStorageButton").addEventListener("click", saveCachedDatatoStorage);
document.getElementById("clearStorageButton").addEventListener("click", clearAllStorage);
document.getElementById("addRuleButton").addEventListener("click", addNewRule);
document.getElementById("updateRuleButton").addEventListener("click", updateExistingRule);
document.getElementById("deleteRuleButton").addEventListener("click", deleteRule);
document.getElementById("clearRuleButton").addEventListener("click", emptyRule);
document.getElementById("prefix").addEventListener("input", ruleNameChanged);
document.getElementById("ruleslist").addEventListener("change", listItemChanged);
document.getElementById("historyButton").addEventListener("click", showHistory);
document.getElementById("addCleanerButton").addEventListener("click", addNewCleaner);
window.addEventListener("load", loadCachedData, false);
document.getElementById("volume").addEventListener("change", writevol);
document.getElementById("playsounds").addEventListener("click", writeplaysounds);
document.getElementById("shownotification").addEventListener("click", writeshownotification);
document.getElementById("historylogdays").addEventListener("change", writedays);
document.getElementById("historylogcountbox").addEventListener("change", writehistorycount);



// RADIO BUTTON EVENTS
// Add Event Radio Button Click.
Array.from(document.querySelectorAll("input[type = \"radio\"]")).forEach(
  (elem  => {elem.addEventListener("change",processRadioButtons);}));

function processRadioButtons(event) {

  var item = event.target.value;
  switch (item) {
    case "redirector":
      hideSection("resolverSection");
      hideSection("sandboxSection");
      showSection("redirectorSection");
    break;
    case "resolver":
      hideSection("redirectorSection");
      hideSection("sandboxSection");
      showSection("resolverSection");
    break;
    case "sandbox":
      hideSection("resolverSection");
      hideSection("redirectorSection");
      showSection("sandboxSection");
    break;
    case "lognever":
      saveDatatoStorage("DownloadLog",1);
      document.getElementById("historyButton").disabled = true;
      document.getElementById("historylogdays").disabled = true;
      document.getElementById("historylogcountbox").disabled = true;
    break;
    case "logrecent":
//      saveDatatoStorage("downloadDays",parseInt(getDomElementValue("historylogdays",7)));
      writedays();
      saveDatatoStorage("DownloadLog",2);
      document.getElementById("historyButton").disabled = false;
      document.getElementById("historylogdays").disabled = false;
      document.getElementById("historylogcountbox").disabled = true;
    break;
    case "logalways":
      saveDatatoStorage("DownloadLog",3);
      document.getElementById("historyButton").disabled = false;
      document.getElementById("historylogdays").disabled = true;
      document.getElementById("historylogcountbox").disabled = true;
    case "logcount":
      saveDatatoStorage("DownloadLog",4);
      saveDatatoStorage("DownloadCount",parseInt(getDomElementValue("historylogcountbox",100)));
      document.getElementById("historyButton").disabled = false;
      document.getElementById("historylogdays").disabled = true;
      document.getElementById("historylogcountbox").disabled = false;
  }
}

function setRadioButton(domID,flag) {
  if (flag == true) {
    document.getElementById(domID).checked = true;
  }
}

// WRITE CHANGED PREFERENCES TO STORAGE */

function writeprefs() {
  writevol();
  writeplaysounds();
  writedays();
  writehistorycount();
  writeshownotification();
  pruneDownloadlist();
}

function writevol() {
  const volume = parseInt(getDomElementValue("volume"),10)/100;
  browser.storage.local.set({volume: volume});
}

function writeplaysounds() {
  const playsounds = document.getElementById("playsounds").checked;
  document.getElementById("volume").disabled = (! playsounds);
  saveDatatoStorage("playsounds",playsounds);
}

function writedays() {
  let delay = parseInt(getDomElementValue("historylogdays",7));
  if (delay == null) { delay=7; }
  browser.storage.local.set({downloadDays: delay});
}

async function writehistorycount() {
  const count = parseInt(getDomElementValue("historylogcountbox",100));
  await saveDatatoStorage("DownloadCount",count);
}

function writeshownotification() {
  const shownotification = document.getElementById("shownotification").checked;
  saveDatatoStorage("shownotification",shownotification);
}


// WRITE OTHER DATA TO STORAGE
function saveCachedDatatoStorage() {
  saveDatatoStorage("AnticontainerData",cachedData);
  saveDatatoStorage("CachedData",cachedData);
}

// READ PREFERENCES FROM STORAGE
async function loadCachedData() {
  let details = await browser.management.getSelf();
  const pos = document.getElementById("version");
  version.textContent = "v. "+details.version;
  cachedData = [];
  cachedData = JSON.parse(await loadDatafromCache());
  clearHTMLOptionsList();
  buildHTMLOptionsList(cachedData);

  const vol = await getPreference("volume",0.4);
  const playsounds = await getPreference("playsounds","true");
  const shownotification = await getPreference("shownotification","true");
  let days = parseInt(await getPreference("downloadDays",7));
  if (days == null) { days=7;}
  const radio = await(getPreference("DownloadLog",3));
  const counter = parseInt(await getPreference("DownloadCount",100));
  setRadioButton("historynolog", radio == 1);
  setRadioButton("historyloglimited", radio == 2);
  setRadioButton("historylogalways", radio == 3);
  setRadioButton("historylogcountbox", radio == 4);
  document.getElementById("historyButton").disabled = (radio == 1);
  document.getElementById("historylogdays").disabled = (radio != 2);
  document.getElementById("historylogcountbox").disabled = (radio != 4);


  document.getElementById("playsounds").checked = (playsounds == "true");
  document.getElementById("shownotification").checked = (shownotification == "true");
  updateDomNode("volume",(vol*100),false);
  updateDomNode("historylogdays",days);
  updateDomNode("historylogcountbox",counter);

}

async function reloadDatafromStorage() {
  cachedData = [];
  let tmp = await loadDatafromStorage();
  cachedData = JSON.parse(tmp["AnticontainerData"]);
  clearHTMLOptionsList();
  buildHTMLOptionsList(cachedData);
}

async function reloadDatafromOldExtension() {
  clearAllStorage();
  loadDatafromOldExtension();
}

function clearAllStorage() {
  clearStorage("CachedData");
  clearStorage("AnticontainerData");
  clearHTMLOptionsList();

  function clearStorage(storageName) {
      browser.storage.local.remove(storageName)
      .then(Success, onError);
    function Success() {
      console.log("OK")
    }
    function onError(error) {
      console.log(error)
    }
  }
}



// DOM / HTML FUNCTIONS //

function clearHTMLOptionsList() {
    Array.from(document.querySelectorAll("option")).forEach(
    (elem  => {
      elem.remove();
    }));
}


function removeHTMLCleaners() {
  let box = document.getElementById("cleanersdiv");
  while (box.hasChildNodes()) {
    box.removeChild(box.lastChild);
  }
}


// Clear all the editable DOM elements.
// Uncheck all the radio buttons.
// Hide all the rule-specific options.
//
// Used when user clicks "Create a new rule" button.
function emptyRule() {
  let disabledSections = document.getElementsByClassName("sectionDisabled");
  while (disabledSections.length > 0) {
    disabledSections[0].classList.remove("sectionDisabled");
  }

  updateDomNode("author","",false);
  updateDomNode("builder","",false);
  updateDomNode("finder","",false);
  updateDomNode("match","",false);
  updateDomNode("namer","",false);
  updateDomNode("ns","",false);
  updateDomNode("pattern","",false);
  updateDomNode("prefix","",false);
  updateDomNode("priority","1",false);
  updateDomNode("replacement","",false);
  updateDomNode("objectID","",false);

  Array.from(document.querySelectorAll("input[type = \"radio\"]")).forEach(
  (elem  => { elem.checked = false; }));

  hideSection("redirectorSection");
  hideSection("resolverSection");
  hideSection("sandboxSection");
  createCleanerItem("","",1);
  document.getElementById("prefix").focus();
}

// Hide DOM element domID (used to hide unnecessary rule-specific options).
function hideSection(domID) {
  var x = document.getElementById(domID);
  if (x != null) {
    x.style.display = "none";
    x.style.visibility = "hidden";
  }
}

// Show DOM element domID (used to show necessary rule-specific options).
function showSection(domID) {
  const x = document.getElementById(domID);
  if (x != null) {
    x.style.display = "grid";
    x.style.visibility = "visible";
  }
}


// Return Document.getElementById("domID").value || empty string;
function getDomElementValue(domId) {
  var x = document.getElementById(domId);
  return ((x.value != null) ? x.value : "");
}

// update DOM node <domID> .value to <mystring (using Stringify if flag set).
function updateDomNode(domID,myString,Stringifyflag) {
  if (myString == null) {myString = "";}
  if (Stringifyflag) {
    document.getElementById(domID).value = myStringify(myString);}
  else {
    document.getElementById(domID).value = myString;
  }

  function myStringify(myString) {
    if ((myString  != null) && (typeof(myString != undefined))) {
      myString = myString.replace(/(\n)/g,"\\n");
      myString = myString.replace(/(\r)/g,"\\r");
    }
    else {
      myString = "";
    }
    return myString;
  }
}

///////////////////
// BUTTON EVENTS //
///////////////////
function addNewRule() {
  cachedData.push({prefix: ""});
  buildRule(cachedData.length);
  ruleNameChanged();
}

function updateExistingRule() {
  buildRule(getDomElementValue("objectID"));
}

// Delete a rule from the list
function deleteRule() {
  const list = document.getElementById("ruleslist");
// <elem> is the DOM item selected in the ruleslist.
  var elem = list.options[list.selectedIndex];
// index is its position in the array
  const index = cachedData.findIndex((element)  => element.prefix == elem.value);
// remove the array (do this AFTER we find its position in the array).
  elem.remove();
// remove the object from the array
  cachedData.splice(index,1);
  emptyRule();
  ruleNameChanged();
}

// Add a rule to the list
// AND
// Update a rule already in the list
function buildRule(ruleID) {
  var newrule = {};
  var errormessage = "";

// Build rule-specific rules.
  if (document.getElementById("resolver").checked) {
    var rules2 = [["finder",false],["builder",false]];
    var cleanercount = document.getElementById("cleanersdiv").childElementCount;

    if (cleanercount > 0) {
      let cleaners = [];
      let cleaner = {};
      for (let f = 1; f <= cleanercount / 4; f++) {
        cleaner.pattern = getDomElementValue("clnr_pattern"+f);
        cleaner.replacement = getDomElementValue("clnr_replacement"+f);
        if ((cleaner.pattern.length > 0) && (cleaner.replacement.length > 0)) {
          cleaners.push(cleaner);
        }
      }
     if(cleaners.length > 0) {
        newrule["cleaners"] = cleaners;
     }
    }
    newrule["type"] = "resolver";
  }

  if (document.getElementById("redirector").checked) {
    var rules2 = [["pattern",true],["replacement",true]];
    newrule["type"] = "redirector";
  }
  if (document.getElementById("sandbox").checked) {
    var rules2 = [["process",false]];
    newrule["type"] = "sandbox";
  }
  newrule["ruleID"] = ruleID;
  newrule["priority"] = parseInt(getDomElementValue("priority"),10);

// Build our object from what the user has input in the form.
// First build the rules common to ALL rule-types.
  const rules1 = [["author",false],["prefix",false],["match",true],["ns",false]];
  rules1.forEach(elem  => {
    var x = parseItem(elem);
    if (x.error != null) {
      errormessage += x.error;
    }
    if (x.data.length > 0) {
      newrule[elem[0]] = x.data;
    }
  });

  if (rules2 == null) {
    errormessage = "You need to select a Rule Type!\n";
  } else {
    rules2.forEach(elem => {
      var x = parseItem(elem);
      if (x.error != null) {
        errormessage += x.error;
      }
      if (x.data.length > 0) {
        newrule[elem[0]] = x.data;
      }
    });
  }

// If there were problems with the user-input.
// Warn the user
// If not, insert or update the rule as appropriate.
  if (errormessage.length > 0) {
    alert("Please fix the following issues:"+errormessage);
  } else {
// If not, insert or update a rule <object> as appropriate.


// If we are updating a rule, delete it and re-add it.
// Because I'm too lazy to write two sets of routine.
    cachedData[ruleID] = newrule;
    saveDatatoStorage("CachedData",cachedData);
    clearHTMLOptionsList();
    buildHTMLOptionsList(cachedData);


// Update the form buttons
//     var event = new Event('change');
//     document.getElementById("ruleslist").dispatchEvent(event);

  }
// Test testObject["DomObject","isRegexFlag"]
// check "DomObject" contents are not empty
// and
// "DomObject" contents contain a valid regular expression (if isRegexFlag is true)
// returns resultObject["DomObject contents","errormessage"]
// or a suitable errorMessage depending on the name of the "DomObject"
  function parseItem(testObject) {
  const errormessage = {
    prefix: "\na Rule Name.",
    match: "\na URL to match against.",
    finder: "\na Pattern.",
    builder: "\na Builder." ,
    pattern: "\na Search Pattern.",
    replacement: "\na Replacement Pattern."
  }
  const regexerrormessage = {
    match: "\na Valid Match Regex.",
    finder: "\na Valid Match Regex.",
    pattern: "\na Valid Match Regex."
  }
    const s = testObject[0];
    const isRegex = testObject[1];
    var x = getDomElementValue(s);
    if (x.length == 0) {
      return ({data:"", error: errormessage[s]}); }
    else {
    if ((x.length > 0) && (isRegex) && (! isValidRegex(x)))
      return ({data: "", error: regexerrormessage[s]}); }
    return ({data: x, error: ""});
  }
}

// check if a string is a valid Regular Expression (no mismatched groups etc).
function isValidRegex(string) {
  var isValid = true;
  try {
    new RegExp(string);
  } catch(e) {
    isValid = false;
  }
  return isValid;
}


// SELECT LIST EVENTS

// Disable/Enable "Add This Rule" Button as user types in "Rule Name" field.
// So we can't overwrite an existing rule by mistake.
function listItemChanged() {

  let disabledSections = document.getElementsByClassName("sectionDisabled");
  while (disabledSections.length > 0) {
     disabledSections[0].classList.remove("sectionDisabled");
  }

  let box = document.getElementById("cleanersdiv");
  while (box.hasChildNodes()) {
    box.removeChild(box.lastChild);
  }

// Element is the Selected Item <ELEMENT> in the list
// index is the position of that item in the cachedData array
//  const index = this.value;
  const index = cachedData.findIndex((element)  => element.ruleID == this.value);
// Read the data for the selected item into objectData
// and populate the form.
  var objectData = cachedData[index];
  if (objectData.cleaners != null) {
    if ((objectData.cleaners.length) > 0) { updateCleaners(objectData.cleaners);}
  }
  if (objectData != null) {
    updateDomNode("prefix",objectData.prefix,true);
    updateDomNode("author",objectData.author,true);
    updateDomNode("match",objectData.match,true);
    updateDomNode("objectID",index,false);
    setRadioButton("defaultReferrer",true);
    setRadioButton("omitReferrer",objectData.omitReferrer);
    setRadioButton("sendInitialReferrer",objectData.sendInitialReferrer);
    setRadioButton("keepReferrer",objectData.keepReferrer);
    updateDomNode("priority", (objectData.priority == null) ? 1 : objectData.priority, false);
    updateDomNode("ns", (objectData.ns == null) ? "Anonymous" : objectData.ns, false);

    switch (objectData.type) {
      case "resolver":
        document.getElementById("resolver").checked = true;
        updateDomNode("finder",objectData.finder,true);
        updateDomNode("builder",objectData.builder,false);
        updateDomNode("namer",objectData.namer,false);
        updateDomNode("pattern","",false);
        updateDomNode("replacement","",false);
      break;
      case "redirector":
        document.getElementById("redirector").checked = true;
        updateDomNode("pattern",objectData.pattern,true);
        updateDomNode("replacement",objectData.replacement,true);
        updateDomNode("finder","",false);
        updateDomNode("builder","",false);
        updateDomNode("namer","",false);
      break;
      case "sandbox":
        document.getElementById("sandbox").checked = true;
        updateDomNode("process",objectData.process,false);
        updateDomNode("finder","",false);
        updateDomNode("builder","",false);
        updateDomNode("namer","",false);
        updateDomNode("pattern",objectData.pattern,true);
        updateDomNode("replacement",objectData.replacement,true);
       break;
    }
    var event = new Event("change");
// Send the appropriate RadioButton Click event, depending on what type of rule it is.
    document.getElementById(objectData.type).dispatchEvent(event);

// Update the form buttons
    ruleNameChanged();
  }
}



function ruleNameChanged() {
  const RuleName = getDomElementValue("prefix");
  var index = -1;
//  console.log(RuleName);
  if ((RuleName == null) || (RuleName == "")) {
    document.getElementById("updateRuleButton").disabled = true;
    document.getElementById("addRuleButton").disabled = true;
    document.getElementById("deleteRuleButton").disabled = true;
  } else {
    const index = cachedData.findIndex((element)  => element.prefix == RuleName);
    if (index == -1) {
      document.getElementById("addRuleButton").disabled = false;
      document.getElementById("deleteRuleButton").disabled = true;
    }
    else {
      document.getElementById("updateRuleButton").disabled = false;
      document.getElementById("addRuleButton").disabled = true;
      document.getElementById("deleteRuleButton").disabled = false;
    }
  }
}



async function showHistory() {
  await writedays();
  let open=await getDownloadWindowId(32);
/*
  var gettingAll = await browser.windows.getAll({windowTypes: ["popup"] });
  gettingAll.forEach(function(obj) {
    if (obj.title === undefined) {
      obj.title = "";
    }
  });
  var open=-1;
  try {
    open = gettingAll.findIndex(item  => item.title.indexOf("Downloaded File History")>0);
  }
  catch(err) {
    console.log(err.message);
    open = -1;
  }
  finally {
*/
  if (open == -1) {
    let createData = {
      type: "popup",
      url: "downloadlist.html",
      width: (document.body.clientWidth-50),
      height: 400
    }
    let historyWindow = await browser.windows.create(createData);
  } else {
    var sending = browser.runtime.sendMessage({greeting: "Update Downloads"});
    const updateData =  { focused: true }
    var updating = browser.windows.update(gettingAll[open].id, updateData);
  }
//}
}

function addNewCleaner() {
  let count=document.getElementById("cleanersdiv").childElementCount / 4;
  createCleanerItem("","",count + 1);
}

function updateCleaners(cleanerArray) {
  removeHTMLCleaners();
  let ptr = 1;
  cleanerArray.forEach(elem  => {
    createCleanerItem(elem.pattern,elem.replacement,ptr++);
  });
}

function createCleanerItem(pattern, replacement, id) {
  let box = document.getElementById("cleanersdiv");
  var lbl1 = document.createElement("label");
  lbl1.id = "clnr_pattern_label"+id;
  lbl1.for = "clnr_pattern"+id;
  lbl1.innerText = "Pattern (cleaner):";
  box.appendChild(lbl1);
  var input1 = document.createElement("input");
  input1.id = "clnr_pattern"+id;
  input1.placeholder = "{1}";
  if (pattern.length > 0) {
    input1.value = pattern;
  }
  box.appendChild(input1);
  var lbl2 = document.createElement("label");
  lbl2.id = "clnr_repl_label"+id;
  lbl2.for = "clnr_replacement"+id;
  lbl2.innerText = "Replacement (cleaner):";
  box.appendChild(lbl2);
  var input2 = document.createElement("input");
  input2.id = "clnr_replacement"+id;
  input2.placeholder = "{1}";
  if (replacement.length > 0) {
    input2.value = replacement;
  }
  box.appendChild(input2);
}
