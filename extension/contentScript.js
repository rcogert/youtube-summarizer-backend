// ==========================================================
// YOUTUBE TLDR SUMMARIZER - CONTENT SCRIPT
// V20: FINAL URL CHANGE TO BREAK NETLIFY CACHE
// ==========================================================

// *** CRITICAL CHANGE HERE: Using the NEW proxy path /api/tldr ***
const API_URL = "https://brilliant-moonbeam-e70394.netlify.app/api/tldr"; 
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
        left: 5px; 
        background: #CC0000;
        color: white;
        border: none;
        padding: 5px 10px;
        font-size: 12px;
        cursor: pointer;
        z-index: 1000;
        border-radius: 4px;
        visibility: hidden; 
        pointer-events: all;
    `;
    button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendForSummary(url); 
    };
    return button;
}

// CRITICAL FIX: The function now takes the hover target separately
function injectButton(container, videoId, isMainPlayer = false, hoverTarget = null) {
    if (container.querySelector(`.${BUTTON_CLASS}`)) {
        return;
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const button = createButton(url);
    
    container.style.position = 'relative'; 
    
    if (isMainPlayer) {
        button.style.visibility = 'visible'; 
        button.style.top = '15px';
        button.style.left = '15px'; 
        button.style.padding = '8px 15px';
    }

    container.appendChild(button);

    if (!isMainPlayer && hoverTarget) {
        hoverTarget.addEventListener('mouseenter', () => { 
            button.style.visibility = 'visible'; 
        });
        hoverTarget.addEventListener('mouseleave', () => { 
            button.style.visibility = 'hidden'; 
        });
    }
}

// ------------------------------------------------------
// 2. NETWORK COMMUNICATION (FINAL URL CHANGE)
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
            return res.json().then(data => {
                throw new Error(`HTTP ${res.status}: ${data.error || 'Unknown Error'}`);
            }).catch(e => {
                 throw new Error(`HTTP ${res.status}: Could not read server response.`);
            });
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
        alert("Error: " + err.message); 
    });
}


// ------------------------------------------------------
// 3. INJECTION LOGIC (INTERVAL SCAN)
// ------------------------------------------------------

function processVideoElements() {
    // A. Handle Main Video Player 
    const mainPlayer = document.querySelector('#movie_player'); 
    
    if (mainPlayer && window.location.href.includes('/watch')) {
        const currentVideoId = new URLSearchParams(window.location.search).get('v');
        if (currentVideoId && !mainPlayer.querySelector(`.${BUTTON_CLASS}`)) {
            injectButton(mainPlayer, currentVideoId, true); 
        }
    }

    // B. Handle all Thumbnails (Homepage, Search, Sidebar)
    const videoLinks = document.querySelectorAll(VIDEO_LINK_SELECTOR);
    
    videoLinks.forEach(link => {
        // Target the highest-level component wrapper for Home/Search
        const homePageContainer = link.closest('ytd-rich-item-renderer');
        
        // Target the image wrapper for Watch Page Sidebar/Related Videos
        const sidebarThumbContainer = link.closest('#thumbnail'); 
        
        let finalContainer = null;
        let videoId = null;
        let hoverTarget = null;
        
        // 1. Sidebar/Related Videos
        if (sidebarThumbContainer) {
            finalContainer = sidebarThumbContainer;
            hoverTarget = link.closest('ytd-compact-video-renderer') || sidebarThumbContainer;
            videoId = new URLSearchParams(link.search).get('v');
        }
        
        // 2. Homepage/Search Results
        else if (homePageContainer) {
            finalContainer = link.closest('ytd-thumbnail') || homePageContainer;
            hoverTarget = homePageContainer; 
            videoId = new URLSearchParams(link.search).get('v');
        }

        if (finalContainer && videoId) {
            injectButton(finalContainer, videoId, false, hoverTarget);
        }
    });
}

// Start the reliable scan loop every 500 milliseconds (0.5 seconds)
setInterval(processVideoElements, 500);