var deviceConnected = true;

var openWindow = function() {
  chrome.app.window.create('main.html', {
    id: "main-window",
    bounds: {
      width: 600,
      height: 600
    }
  });
}

var checkForMedia = function() {
  chrome.mediaGalleries.getMediaFileSystems({interactive: "if_needed"}, function(filesystems) {
    var found = false;

    for (i = 0; i < filesystems.length; i++) {
      var fs = filesystems[i];
      var info = chrome.mediaGalleries.getMediaFileSystemMetadata(fs);

      if (info.isRemovable) {
        found = true;
        
        if (!deviceConnected) {
          openWindow();
        }
      }
    }

    deviceConnected = found;

    setTimeout(checkForMedia, 3000);
  });
}

chrome.app.runtime.onLaunched.addListener(openWindow);
checkForMedia();