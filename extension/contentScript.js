// contentScript.js

console.log("YouTube TLDR Summarizer content script loaded.");

const API_URL = "https://brilliant-moonbeam-e70394.netlify.app/.netlify/functions/summarize";

// Watch for dynamic YouTube DOM changes
const observer = new MutationObserver(() => {
  attachToThumbnails();
  attachToMainVideo();
});

observer.observe(document.body, { childList: true, subtree: true });


// ------------------------------------------------------
// 1. Attach TLDR button to thumbnails (homepage / search)
// ------------------------------------------------------
function attachToThumbnails() {
  const thumbnails = document.querySelectorAll("a.yt-lockup-view-model__content-image");

  thumbnails.forEach((thumb) => {
    if (thumb.dataset.tldrInjected) return;

    thumb.style.position = "relative";

    const btn = createHoverButton();

    thumb.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
    thumb.addEventListener("mouseleave", () => (btn.style.opacity = "0"));

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendForSummary(thumb.href);
    });

    thumb.appendChild(btn);
    thumb.dataset.tldrInjected = "true";
  });
}


// ------------------------------------------------------
// 2. Attach TLDR button to the main video page
// ------------------------------------------------------
function attachToMainVideo() {
  const titleEl = document.querySelector("ytd-watch-metadata yt-formatted-string.style-scope.ytd-watch-metadata");

  if (!titleEl) return;
  if (titleEl.dataset.tldrInjected) return;

  const btn = document.createElement("button");
  btn.textContent = "TLDR";
  btn.style.marginLeft = "12px";
  btn.style.padding = "6px 10px";
  btn.style.background = "#000000cc";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "4px";
  btn.style.cursor = "pointer";

  btn.addEventListener("click", () => {
    const url = window.location.href;
    sendForSummary(url);
  });

  titleEl.after(btn);
  titleEl.dataset.tldrInjected = "true";
}


// ------------------------------------------------------
// 3. Button used on thumbnails (hover fade-in)
// ------------------------------------------------------
function createHoverButton() {
  const btn = document.createElement("div");

  btn.textContent = "TLDR";
  btn.style.position = "absolute";
  btn.style.top = "6px";
  btn.style.right = "6px";
  btn.style.padding = "3px 6px";
  btn.style.background = "rgba(0,0,0,0.55)";
  btn.style.color = "white";
  btn.style.fontSize = "10px";
  btn.style.borderRadius = "3px";
  btn.style.cursor = "pointer";
  btn.style.opacity = "0";
  btn.style.transition = "opacity 0.2s ease-in-out";
  btn.style.zIndex = "9999";

  return btn;
}


// ------------------------------------------------------
// 4. Communicate with your Netlify summarizer
// ------------------------------------------------------
function sendForSummary(url) {
  console.log("Summarizing:", url);

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrl: url }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.summary) showSummaryPopup(data.summary);
      else alert("No summary returned.");
    })
    .catch((err) => alert("Error: " + err.message));
}


// ------------------------------------------------------
// 5. Summary popup modal
// ------------------------------------------------------
function showSummaryPopup(text) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "rgba(0,0,0,0.6)";
  overlay.style.zIndex = 999999;
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const box = document.createElement("div");
  box.style.background = "white";
  box.style.padding = "20px";
  box.style.borderRadius = "8px";
  box.style.maxWidth = "600px";
  box.style.maxHeight = "70vh";
  box.style.overflowY = "auto";
  box.style.fontSize = "14px";
  box.style.lineHeight = "1.4";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.marginTop = "10px";
  closeBtn.style.padding = "6px 12px";
  closeBtn.style.background = "#000000cc";
  closeBtn.style.color = "white";
  closeBtn.style.border = "none";
  closeBtn.style.borderRadius = "4px";
  closeBtn.style.cursor = "pointer";

  closeBtn.addEventListener("click", () => document.body.removeChild(overlay));

  box.innerHTML = `<strong>Summary</strong><br><br>${text}`;
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}
