# Bunny Stream community-video setup

Riches AI Network now uses **Bunny Stream** for short, paid-member community video posts. The application creates a Bunny video object server-side, gives the member a short-lived TUS upload signature, and exposes playback only through short-lived, server-signed embed URLs.

## What is already configured in the application

The protected Manus project secrets now contain the Bunny Stream library credentials. They are not in source control and must never be pasted into chat or browser code.

The platform defaults are intentionally conservative:

| Rule | Default | Admin-configurable range |
|---|---:|---:|
| Video uploads per paid member, per UTC day | 1 | 0–5 |
| Active unposted/published video records per member | 3 | 1–20 |
| Source file size | 250 MB | 25–1,000 MB |
| Duration | 180 seconds | 15–600 seconds |
| Formats | MP4, MOV, WebM | Fixed |
| Attachments | One video **or** one image per post | Fixed |

Members must add text context before sharing a ready video. Videos do not appear in the feed until Bunny finishes processing and the post is published.

## Bunny Dashboard steps still required

### 1. Enable protected embeds

In **Bunny Stream → your video library → Security**:

1. Enable **Embed View Token Authentication**.
2. Keep the token-authentication key private; it is already stored as a protected project secret.
3. Add the application’s permitted embed domains. For the current Preview, add:

```text
8328-iqw2vgew0jam8za26w1xc-c557bf5f.us1.manus.computer
```

Do not include `https://`. Add the production website domain later, before publishing.

### 2. Configure the processing webhook

In **Bunny Stream → your video library → Webhooks**, add this callback after the application has a stable public domain:

```text
https://YOUR-PUBLISHED-DOMAIN/api/webhooks/bunny-stream
```

For temporary Preview validation, the current endpoint is:

```text
https://8328-iqw2vgew0jam8za26w1xc-c557bf5f.us1.manus.computer/api/webhooks/bunny-stream
```

The endpoint checks Bunny’s `v1` HMAC-SHA256 signature against the library **Read-Only API Key** using the raw request body. It updates processing status, duration, and size; it deletes and rejects over-limit files automatically.

The app also lets a member manually check the video’s processing status, so a webhook is not the only way to see a ready state. The webhook remains important for reliable background processing updates.

### 3. Do not change domain nameservers for this feature

`kiki.bunny.net` and `coco.bunny.net` are Bunny DNS nameservers. They are **not** required for Bunny Stream uploads, signed playback, or video webhooks. Do not change nameservers merely to operate this community-video feature. A future Bunny DNS/CDN setup for a custom website domain would be a separate domain-management decision.

## Operational controls

Open **Admin → Community** to:

- turn the whole community on or off;
- enable or disable member video uploads separately;
- change the daily, active-draft, duration, and size limits within safe bounds;
- hide a video from the feed;
- restore a hidden processed video;
- delete a video, including its Bunny Stream asset;
- suspend, ban, or temporarily block a member; and
- review the moderation audit trail.

Deleting a community post that has a video also marks the local record deleted and requests remote Bunny cleanup. Bunny documents that CDN playback may remain available briefly after deletion while invalidation propagates; the application removes the signed in-feed playback path immediately.

## Security boundaries

- The browser receives only a temporary TUS upload signature and the non-secret library/video identifiers.
- Bunny Stream API, token-authentication, and read-only webhook keys remain server-only.
- Paid membership, community enablement, suspension, posting blocks, quotas, video ownership, and video readiness are checked on the server and database before upload, finalization, playback, or posting.
- Raw Bunny webhook bodies are authenticated with constant-time HMAC comparison.
- Community video records are private to service operations; the feed receives only a short-lived signed embed URL after access is authorized.

## Processing status and upload reconciliation (October 2026)

[Bunny's official webhook status table](https://bunny.net/docs/stream/webhooks) says: 0 queued, 1 processing metadata, 2 encoding, 3 finished, 4 resolution finished (first resolution is already playable), 5 failed, 6 presigned upload started, 7 presigned upload finished, 8 presigned upload failed, 9 captions generated, 10 title/description generated. The app should not treat code 8 as ready. The [TUS upload contract](https://bunny.net/docs/stream/tus-resumable-uploads) requires authenticated POST/PATCH/HEAD, a returned `Upload-Offset` for accepted bytes, and separately authenticated resumptions. A stale database status does not prove Bunny remains processing; reconcile owned draft status against Bunny when the member opens or refreshes the community page.

### Verified upload and preview behavior

A disposable MP4 was transferred through Bunny's real TUS endpoint with the same client uploader: the final HEAD confirmed all 75,502 bytes, Bunny advanced from encoding (2) to finished (3), and the disposable asset was deleted. Bunny's TUS creation response may omit `Upload-Offset`, so the client starts at zero and verifies every subsequent PATCH and final HEAD. A mobile upload is **not** failed merely because Bunny reports zero encoded-storage bytes during the first 90 seconds; the draft expires only after its signed upload period. The member's draft read refresh reconciles its state against Bunny even if a webhook is late or absent.

The composer now distinguishes preparing, byte-transfer percentage, Bunny encoding, ready, and failed/rejected states. While the original file remains selected, it shows a muted looping local preview without pressing Play. If the browser cannot decode that file, it shows an explicit fallback; after reload, an already-ready draft receives a signed Bunny player preview. The composer stays visible during background status checks. Source upload size is limited at the browser and reservation boundary; Bunny's `storageSize` counts multiple encoded renditions and is **not** the original-file byte count. Bunny duration remains checked against the administrator's limit after processing.

### Interrupted transfers and direct-upload trust boundary

During a new direct upload, the browser saves only Bunny's opaque TUS location in session storage. On the **same tab**, members may choose the same original file under **Resume upload**; the server checks current paid-member access and re-signs the existing owned Bunny video, while Bunny HEAD must match the original file's byte length and reveals the persisted offset. If browser session storage is cleared, the user must remove the draft and start again. A completed transfer is kept even if its first processing-status check temporarily fails; the member can refresh its status without losing the file.

The default 250 MB source-size check applies at the client and server reservation, and the normal client checks Bunny's stored TUS `Upload-Length`. These checks do **not** cryptographically prevent a deliberately modified client from initiating a separate, larger TUS upload using temporarily issued direct-upload credentials. Bunny `storageSize` includes encoded renditions, so it cannot be used as a reliable source-size proxy. Strict enforcement against hostile clients requires a trusted upload-resource binding or a different transfer architecture; this is recorded as open hardening in `TODO.md` rather than claiming it is already guaranteed.

In a second live provider test Bunny accepted the entire PATCH payload, then temporarily returned **503 to the immediate final HEAD**. The uploader now retries transient HEAD responses; if Bunny remains unavailable, the member sees **100% bytes acknowledged; verification pending** while the draft is retained and its actual provider encoding status is polled. This is intentionally different from losing the uploaded file or declaring it shareable before Bunny marks it ready.
