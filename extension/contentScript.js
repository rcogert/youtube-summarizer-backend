// ==========================================================
// YOUTUBE TLDR SUMMARIZER - CONTENT SCRIPT
// V15: Final URL Structure Fix (Proxy Route)
// ==========================================================

// *** CRITICAL CHANGE HERE: Using the clean proxy path ***
const API_URL = "https://brilliant-moonbeam-e70394.netlify.app/api/summarize"; 
const BUTTON_CLASS = "tldr-summarizer-button";
const VIDEO_LINK_SELECTOR = 'a[href*="/watch?v="]'; 

// --- UI AND DISPLAY ---

function showSummaryPopup(summary) {
    alert("Summary:\n\n" + summary);
}

function createButton(url) {
    const button = document.createElement('button');
    button.className = BUTTON_CLASS;
    button.textContent = 'TLDR';
    button.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: #CC0000;
        color: white;
        border: none;
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
        z-index: 1000;
        border-radius: 4px;
        display: none;
        pointer-events: all;
    `;
    button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendForSummary(url); 
    };
    return button;
}

function injectButton(container, videoId, isMainPlayer = false) {
    if (container.querySelector(`.${BUTTON_CLASS}`)) {
        return;
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const button = createButton(url);
    
    container.style.position = 'relative'; 
    
    if (isMainPlayer) {
        button.style.display = 'block'; 
        button.style.top = '10px';
        button.style.right = '10px';
    }

    container.appendChild(button);

    if (!isMainPlayer) {
        container.addEventListener('mouseenter', () => { 
            button.style.display = 'block'; 
        });
        container.addEventListener('mouseleave', () => { 
            button.style.display = 'none'; 
        });
    }
}

// ------------------------------------------------------
// 2. NETWORK COMMUNICATION (FINAL URL FIX)
// ------------------------------------------------------
function sendForSummary(url) {
  console.log("URL being sent to Netlify:", url); 

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ videoUrl: url }),
  })
    .then((res) => {
        if (!res.ok) {
            console.error("API Fetch Failed with Status:", res.status, res.statusText);
            // We now expect to see logs in Netlify if this fails!
            throw new Error(`HTTP error! Status: ${res.status}`);
        }
        return res.json();
    })
    .then((data) => {
      if (data.summary) {
          showSummaryPopup(data.summary); 
      }
      else if (data.error) {
          alert("Summary Error: " + data.error);
      }
      else {
          alert("No summary returned.");
      }
    })
    .catch((err) => {
        console.error("Fetch/API Error:", err);
        alert("Error: Failed to fetch summary. Check the console for network details.");
    });
}


// ------------------------------------------------------
// 3. INJECTION LOGIC (INTERVAL SCAN)
// ------------------------------------------------------

function processVideoElements() {
    // A. Handle Main Video Player
    const mainPlayer = document.querySelector('#movie_player');
    const mainPlayerWrapper = mainPlayer ? mainPlayer.closest('ytd-watch-flexy') : null; 

    if (mainPlayerWrapper && window.location.href.includes('/watch')) {
        const currentVideoId = new URLSearchParams(window.location.search).get('v');
        if (currentVideoId && !mainPlayerWrapper.querySelector(`.${BUTTON_CLASS}`)) {
            injectButton(mainPlayerWrapper, currentVideoId, true);
        }
    }

    // B. Handle all Thumbnails 
    const videoLinks = document.querySelectorAll(VIDEO_LINK_SELECTOR);
    
    videoLinks.forEach(link => {
        const homePageContainer = link.closest('ytd-rich-grid-media') || link.closest('ytd-rich-item-renderer');
        const sidebarContainer = link.closest('ytd-compact-video-renderer'); 
        
        let finalContainer = null;
        let videoId = null;
        
        if (sidebarContainer) {
             const thumbWrapper = sidebarContainer.querySelector('#thumbnail');
             if (thumbWrapper && !thumbWrapper.querySelector(`.${BUTTON_CLASS}`)) {
                finalContainer = thumbWrapper;
                videoId = new URLSearchParams(link.search).get('v');
             }
        }
        
        if (homePageContainer) {
            finalContainer = homePageContainer;
            videoId = new URLSearchParams(link.search).get('v');
        }

        if (finalContainer && videoId) {
            injectButton(finalContainer, videoId, false);
        }
    });
}

// Start the reliable scan loop every 500 milliseconds (0.5 seconds)
setInterval(processVideoElements, 500);