document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const summaryEl = document.getElementById("summary");

  const { lastSummary, lastVideoId } = await chrome.storage.local.get([
    "lastSummary",
    "lastVideoId"
  ]);

  if (!lastSummary) {
    statusEl.textContent =
      'No summary yet. Hover over a YouTube video and click "Summarize".';
    summaryEl.textContent = "";
    return;
  }

  statusEl.textContent = lastVideoId
    ? `Last summarized video: ${lastVideoId}`
    : "Last summary:";

  summaryEl.textContent = lastSummary;
});
