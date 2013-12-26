var files = [];
var dirs = [];
var reader;
var access_token;

$(function() {
  chrome.mediaGalleries.getMediaFileSystems({interactive: "if_needed"}, function(filesystems) {
    $(filesystems).each(function() {
      var info = chrome.mediaGalleries.getMediaFileSystemMetadata(this);

      if (info.isRemovable) {
        reader = this.root.createReader();
        reader.readEntries(scanGallery);
      }
    });
  });

  $("button").click(function() {
    hideError();

    if ($("#title").val() == "") {
      showError("Please enter a title for your new album.");
      showActions();
      return;
    }

    showMessage("Preparing to import...");
    hideActions();

    chrome.identity.getAuthToken({interactive: true}, function(token) {
      if (!token) return;
      access_token = token;

      getPhotosFolder(function(photos) {
        if (photos) {
          createFolderUnder($("#title").val(), photos, function(folder) {
            uploadFiles(folder, 0);
          });
        } else {
          showError("No \"Photos\" folder found in your Google Drive top directory.");
          showMessage("Found " + files.length + " images.");
          showActions();
        }
      });
    });
  });
});

function uploadFiles(folder, index) {
  if (index == files.length) {
    showMessage("All done!!!");
    return;
  }

  showMessage("Importing " + (index + 1) + " of " + files.length);

  files[index].file(function(f) {
    var uploader = new MediaUploader({
      file: f,
      token: access_token,
      metadata: {
        title: f.name,
        mimeType: f.contentType,
        parents: [{
          kind: "drive#fileLink",
          id: folder.id
        }]
      }
    });

    uploader.onComplete = function() {
      uploadFiles(folder, index + 1);
    }

    uploader.onError = function() {
      showMessage("Could not upload file.");
      showActions();
    }

    uploader.upload();
  });
}

function createFolderUnder(title, under, callback) {
  gapiRequest({
    path: "/drive/v2/files",
    method: "POST",
    body: {
      title: title,
      parents: [{id: under.id}],
      mimeType: "application/vnd.google-apps.folder"
    },
    callback: callback
  });
}

function getPhotosFolder(callback) {
  var retrievePageOfFiles = function(resp) {
    for (i = 0; i < resp.items.length; i++) {
      var item = resp.items[i]

      if (item.mimeType == "application/vnd.google-apps.folder") {
        callback(item);
        return;
      }
    }

    var nextPageToken = resp.nextPageToken;
    if (nextPageToken) {
      gapiRequest({
        params: {'pageToken': nextPageToken},
        callback: retrievePageOfFiles
      });
    } else {
      callback(null);
    }
  };

  gapiRequest({
    path: "/drive/v2/files",
    params: {q: "'root' in parents and title = 'Photos'"},
    callback: retrievePageOfFiles
  });
}

function scanGallery(entries) {
  if (entries.length == 0) {
    if (dirs.length) {
      var dir = dirs.shift();
      reader = dir.createReader();
      reader.readEntries(scanGallery);
    } else {
      showImages();
    }

    return;
  }

  for (var i = 0; i < entries.length; i++) {
    if (entries[i].isFile) {
      files.push(entries[i]);
    } else if (entries[i].isDirectory) {
      dirs.push(entries[i]);
    }
  }

  reader.readEntries(scanGallery)
}

function showImages() {
  showMessage("Found " + files.length + " images.");

  $(files).each(function() {
    var fs = this;
    var img = $("<img></img>");
    $("#images").append(img);

    fs.file(function(f) {
      var reader = new FileReader();
      reader.onloadend = function(e) {
        img[0].src = this.result;
      };
      reader.readAsDataURL(f);
    });
  });
}

function showMessage(message) {
  $("#message").text(message);
}

function showError(message) {
  $("p.error").show();
  $("p.error").text(message);
}

function hideError() {
  $("p.error").hide();
}

function hideActions() {
  $("#actions").hide();
}

function showActions() {
  $("#actions").show();
}

function gapiRequest(args) {
  if (typeof args !== 'object')
    throw new Error('args required');
  if (typeof args.callback !== 'function')
    throw new Error('callback required');
  if (typeof args.path !== 'string')
    throw new Error('path required');

  var path = 'https://www.googleapis.com' + args.path;
  if (typeof args.params === 'object') {
    var deliminator = '?';
    for (var i in args.params) {
      path += deliminator + encodeURIComponent(i) + "="
        + encodeURIComponent(args.params[i]);
      deliminator = '&';
    }
  }

  var xhr = new XMLHttpRequest();
  xhr.open(args.method || 'GET', path);
  xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
  if (typeof args.body !== 'undefined') {
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.send(JSON.stringify(args.body));
  } else {
    xhr.send();
  }

  xhr.onload = function() {
    var rawResponseObject = {
      // TODO: body, headers.
      gapiRequest: {
        data: {
          status: this.status,
          statusText: this.statusText
        }
      }
    };

    var jsonResp = JSON.parse(this.response);
    var rawResp = JSON.stringify(rawResponseObject);
    args.callback(jsonResp, rawResp);
  };
};