// Robust content script: MutationObserver-based injection for YouTube thumbnails + player button.
// Sends POST { videoId } to the Netlify endpoint.
// Updated API_URL to the provided Netlify function.

const API_URL = "https://chimerical-semifreddo-7dfac2.netlify.app/.netlify/functions/summarize";
const BUTTON_CLASS = "tldr-summarizer-button";
const THUMBNAIL_SELECTORS = [
  'ytd-rich-grid-media',
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-thumbnail'
];

function createButton(videoId, isMainPlayer = false) {
  const button = document.createElement('button');
  button.className = BUTTON_CLASS;
  button.textContent = 'TLDR';
  button.style.cssText = `
    position: absolute;
    z-index: 10000;
    padding: ${isMainPlayer ? '8px 15px' : '6px 10px'};
    font-size: 12px;
    border-radius: 4px;
    background: rgba(204,0,0,0.95);
    color: white;
    border: none;
    cursor: pointer;
    right: 6px;
    top: 6px;
    visibility: ${isMainPlayer ? 'visible' : 'hidden'};
  `;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    sendForSummary(videoId);
  });
  return button;
}

function ensurePositioned(el) {
  try {
    const cs = window.getComputedStyle(el);
    if (cs.position === 'static') {
      el.style.position = 'relative';
    }
  } catch (err) {
    // ignore
  }
}

async function sendForSummary(videoId) {
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    if (!resp.ok) {
      let bodyText = '';
      try { bodyText = await resp.text(); } catch (e) {}
      console.error('Summary API error', resp.status, bodyText);
      if (resp.status === 404) {
        alert('Cannot access English captions for this video. Try a different video.');
      } else {
        alert(`Summary API error: ${resp.status}`);
      }
      return;
    }
    const data = await resp.json();
    if (data.summary) {
      showSummaryPopup(data.summary);
      chrome.storage.local.set({ lastSummary: data.summary, lastVideoId: videoId });
    } else if (data.error) {
      alert('Summary Error: ' + data.error);
    } else {
      alert('No summary returned.');
    }
  } catch (err) {
    console.error('Fetch/API Error:', err);
    alert('Error: ' + (err.message || err));
  }
}

function showSummaryPopup(summary) {
  alert('Summary:\n\n' + summary);
}

function alreadyInjected(container) {
  return !!container.querySelector(`.${BUTTON_CLASS}`);
}

function injectIntoContainer(container, videoId, isMainPlayer = false, hoverTarget = null) {
  if (!container || !videoId || alreadyInjected(container)) return;
  ensurePositioned(container);
  const btn = createButton(videoId, isMainPlayer);
  const anchor = container.querySelector('a#thumbnail, a.yt-simple-endpoint') || container;
  try {
    anchor.appendChild(btn);
  } catch (err) {
    container.appendChild(btn);
  }
  container.dataset.tldrInjected = '1';

  if (!isMainPlayer && hoverTarget) {
    hoverTarget.addEventListener('mouseenter', () => { btn.style.visibility = 'visible'; });
    hoverTarget.addEventListener('mouseleave', () => { btn.style.visibility = 'hidden'; });
  }
}

function extractVideoIdFromLink(link) {
  try {
    const url = new URL(link.href, location.origin);
    return url.searchParams.get('v');
  } catch (err) {
    return null;
  }
}

function scanAndInject(root = document) {
  for (const sel of THUMBNAIL_SELECTORS) {
    const nodes = Array.from(root.querySelectorAll(sel));
    if (!nodes.length) continue;
    for (const node of nodes) {
      const link = node.querySelector('a[href*="/watch?v="]');
      const videoId = link ? extractVideoIdFromLink(link) : null;
      if (videoId) {
        injectIntoContainer(node, videoId, false, node);
      }
    }
  }

  const mainPlayer = document.querySelector('#movie_player, ytd-player');
  if (mainPlayer && location.pathname.includes('/watch')) {
    const currentVideoId = new URLSearchParams(location.search).get('v');
    if (currentVideoId && !mainPlayer.querySelector(`.${BUTTON_CLASS}`)) {
      injectIntoContainer(mainPlayer, currentVideoId, true);
    }
  }
}

const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes && m.addedNodes.length) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        for (const sel of THUMBNAIL_SELECTORS) {
          if ((n.matches && n.matches(sel)) || (n.querySelector && n.querySelector(sel))) {
            scanAndInject(n);
            break;
          }
        }
      }
    }
  }
});

function start() {
  const containers = [
    document.querySelector('ytd-rich-grid-renderer'),
    document.querySelector('ytd-section-list-renderer'),
    document.body
  ].filter(Boolean);

  for (const c of containers) {
    try {
      observer.observe(c, { childList: true, subtree: true });
    } catch (err) {
      console.warn('Observer failed on container', c, err);
    }
  }
  scanAndInject(document);
  window.addEventListener('yt-navigate-finish', () => setTimeout(() => { scanAndInject(document); }, 700));
  window.addEventListener('popstate', () => setTimeout(() => { scanAndInject(document); }, 700));
}

try { start(); } catch (err) { console.error('contentScript init error', err); }
