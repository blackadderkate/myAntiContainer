var foo=meh();
foo;

function meh() {
  var html = "";
  var urls=[];
  if (typeof window.getSelection != "undefined") {
    var sel = window.getSelection();
    if (sel.rangeCount) {
      var container = document.createElement("div");
      for (var i = 0, len = sel.rangeCount; i < len; ++i) {
          container.appendChild(sel.getRangeAt(i).cloneContents());
      }
     var matches = container.querySelectorAll("a");
     for (let links of matches) {
       if (urls.indexOf(links.href) == -1) {
         urls.push(links.href); }
     }
    }
  }
  return JSON.stringify(urls);
}
