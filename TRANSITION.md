Next steps for YouTube TLDR Summarizer

1) Data: Use YouTube Data API (preferred) via server-side OAuth:
   - Create OAuth credentials in Google Cloud Console.
   - Obtain a refresh token for the account that can access captions.
   - Set env vars in Netlify:
       GOOGLE_CLIENT_ID
       GOOGLE_CLIENT_SECRET
       GOOGLE_REFRESH_TOKEN
   - Deploy netlify/functions/getTranscript.js and test with a known videoId that has captions.

2) UI: The extension now uses a MutationObserver-based content script to inject TLDR buttons on thumbnails and the player. If YouTube changes layout, update THUMBNAIL_SELECTORS in extension/contentScript.js using the browser inspector.

3) Error handling & UX:
   - Netlify function should return structured errors: no_captions, auth_error, rate_limited, server_error.
   - Consider replacing alerts with a popup panel or in-page modal for better UX.

4) Caching & quotas:
   - Add caching in the Netlify function (cache by videoId + lang) to reduce API calls.
   - Monitor quota usage and consider a paid transcription provider if quotas are insufficient.

5) Deploy & Test:
   - Add OAuth env vars to Netlify.
   - Deploy function and test with known video IDs.
   - Load the extension unpacked in Chrome (developer mode), navigate YouTube homepage and watch pages, and verify TLDR buttons show up and fetching works.
