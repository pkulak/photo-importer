chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('main.html', {
    id: "main-window",
    bounds: {
      width: 600,
      height: 600
    }
  });
});