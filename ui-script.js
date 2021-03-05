// ==UserScript==
// @name     WhatsappDump
// @version  1
// @grant        GM.xmlHttpRequest
// @include  https://web.whatsapp.com/*
// ==/UserScript==


// Load all messages for currently opened chat (wait for div with title="load earlier messages…")
function waitForMessages(oldNumMessages) {
    let divLoading = document.evaluate("count(//div[property[@name='title' and @value='load earlier messages…']])", document, null, XPathResult.ANY_TYPE, null);
    
    if (divLoading.numberValue > 0) {
      // Load in progress
      console.log("waiting for messages loading");
      setTimeout(() => waitForMessages(oldNumMessages), 1000);
    } else {
      let msgsFound = document.getElementsByClassName("focusable-list-item");
      
      if (oldNumMessages == msgsFound.length) {
        // No new messages, ending now
        console.log("Ending, messages: " + oldNumMessages);
        scrapeAllMessages(msgsFound);
      } else {
        // New messages found, cycling
        oldNumMessages = msgsFound.length;
        console.log("Continuing... " + oldNumMessages);
  
        msgsFound[0].focus();
        setTimeout(() => waitForMessages(oldNumMessages), 1000);
      }
    }
  }
  
  // Scrape all loaded messages
  function scrapeAllMessages(msgsTags) {
    /*
      for (const a of document.querySelectorAll("span")) {
        if (a.textContent == "Read more") {
          TODO: tap the button before getting the text
        }
      }
      */
    
    if (triggerAllMediaDownload()) {
      // Media to download found and download triggered, wait for download and try again
      setTimeout(function() {
        scrapeAllMessages(msgsTags);
      }, 10*1000);
      return;
    }
  
    let header = document.getElementById("main").getElementsByTagName("header")[0];
    
    let chatId = null;
    let title = header.children[1].children[0].innerText;
    
    let msgs = {};
    
    // Cycle each message in the chatroom
    for (var tidx in msgsTags) {
      if (!msgsTags.hasOwnProperty(tidx)) continue;
      
      let m = msgsTags[tidx];
      
      // The div is a real message?
      if (m.dataset && m.dataset.id) {
        
        // Get the chat ID from one message
        if (chatId == null) {
          chatId = m.dataset.id.toString().split("@")[0].split("_")[1];
        }
        
        // Text messages have at least one copyable-text inside
        let copyText = m.getElementsByClassName("copyable-text");
        
        // Audio will have an <audio> element
        let audios = m.getElementsByTagName("audio");
        
        if (copyText.length > 0 && copyText[0].dataset && copyText[0].dataset.prePlainText) {
          let textmsg = copyText[0].children[0].innerText;
          let citemsg = null;
          
          // If the message contains a citation, extract it
          if (copyText[0].children.length == 2) {
            citemsg = copyText[0].children[0].innerText;
            textmsg = copyText[0].children[1].innerText;
          }
          
          msgs[m.dataset.id] = {
            kind: "text",
            text: textmsg,
            cite: citemsg,
            date: copyText[0].dataset.prePlainText,
          }
        } else if (audios.length > 0) {
          // Upload the audio separately
          downloadAndSendBlob(chatId, m.dataset.id, audios[0].src);
        }
        
        let imgs = m.getElementsByTagName("img");
        
        for (var iidx in imgs) {
          if (!imgs.hasOwnProperty(iidx)) continue;
          
          let img = imgs[iidx];
          if (img.src.startsWith("blob:")) {
          // Upload each image separately
            downloadAndSendBlob(chatId, m.dataset.id, img.src);
          }
        }
      }
    }
    
    // Save the text message list
    GM.xmlHttpRequest({
      method: "POST",
      url: "http://localhost:8080/?chatid=" + chatId.toString(),
      data: JSON.stringify({
        title: title,
        messages: msgs,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      onload: function(response) {
        console.log("Saved");
      },
      onerror: function(response) {
        console.error(response);
      }
    });
    
    // Save the current chat picture (user/group)
    clickOnElement(header.children[0]);
    setTimeout(function() {
      
      let xpathResult = document.evaluate( "//*/span[@data-testid='default-user']", document, null, XPathResult.ANY_TYPE, null );
      let spanPictureNode = xpathResult.iterateNext();
      
      let imgSrc = spanPictureNode.parentElement.parentElement.getElementsByTagName("img")[0].src;
      downloadAndSendProfilePicture(chatId, imgSrc);
      
      alert("Done");
      
      // The end
    }, 2000);
  }
  
  
  
  
  /* **************************************** UTILITIES **************************************** */
  
  // Send click event to element
  function clickOnElement(element) {
    if(document.createEvent) {
        var click = document.createEvent("MouseEvents");
        click.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        element.dispatchEvent(click);
        element.focus();
    } else if(document.documentElement.fireEvent) {
        element.fireEvent("onclick");
        element.focus();
    }
  }
  
  
  // Trigger the download for all media/audio. Returns true if at least one element is being downloaded, false otherwise
  function triggerAllMediaDownload() {
    var itemExists = false;
    
    console.log("Triggering audio");
    var iterator = document.evaluate( "//*/span[@data-testid='audio-download']", document, null, XPathResult.ANY_TYPE, null );
    try {
      var thisNode = iterator.iterateNext();
  
      while (thisNode) {
        console.log(thisNode);
        itemExists = true;
        clickOnElement(thisNode);
        thisNode = iterator.iterateNext();
      }
    } catch (e) {
      console.error( 'Error: Document tree modified during iteration ' + e );
    }
    
    // TODO: this part has a bug: if the chat contains a media that is non-picture, it loops forever and crashes the browser
    
    //console.log("Triggering media");
    //iterator = document.evaluate( "//*/span[@data-testid='media-download']", document, null, XPathResult.ANY_TYPE, null );
    /*try {
      var thisNode = iterator.iterateNext();
  
      while (thisNode) {
        console.log(thisNode);
        itemExists = true;
        clickOnElement(thisNode);
        thisNode = iterator.iterateNext();
      }
    } catch (e) {
      console.error( 'Error: Document tree modified during iteration ' + e );
    }*/
    
    return itemExists;
  }
  
  
  // Download and send the chat picture from URL
  function downloadAndSendProfilePicture(chatId, url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onload = function() {
      if (this.status == 200) {
        GM.xmlHttpRequest({
          method: "POST",
          url: "http://localhost:8080/chatpicture?chatid=" + chatId,
          data: this.response,
          headers: {
            "Content-Type": this.response.type,
          },
          onload: function(response) {
            console.log("Blob saved");
          },
          onerror: function(response) {
            console.error(response);
          }
        });
      }
    }
    xhr.send();
  }
  
  
  // Download and send the media from URL/blob
  function downloadAndSendBlob(chatId, id, blob) {
    // TODO: save timestamps
    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', blob, true);
    xhr.responseType = 'blob';
    xhr.onload = function() {
      if (this.status == 200) {
        GM.xmlHttpRequest({
          method: "POST",
          url: "http://localhost:8080/blob?id=" + encodeURIComponent(id) + "&chatid=" + chatId,
          data: this.response,
          headers: {
            "Content-Type": this.response.type,
          },
          onload: function(response) {
            console.log("Blob saved");
          },
          onerror: function(response) {
            console.error(response);
          }
        });
      }
    }
    xhr.send();
  }
  
  //clickOnElement(document.getElementById("pane-side").children[0].children[0].children[0].children[9]);
  
  // Add the "Export" button
  let btn = document.createElement("button");
  btn.id = "exportbackup";
  btn.style.position = "absolute";
  btn.style.top = "0";
  btn.style.right = "0";
  btn.innerText = "Export";
  btn.style.zIndex = "2000";
  btn.style.backgroundColor = "white";
  btn.style.padding = "10px";
  btn.addEventListener("click", function() { waitForMessages(0); }, false);
  document.body.appendChild(btn);
  