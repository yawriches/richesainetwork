export type BunnyUploadSession = {
  endpoint: string;
  signature: string;
  expiresAt: number;
  videoId: string;
  libraryId: string | number;
};

export type BunnyUploadOptions = {
  signal?: AbortSignal;
  onProgress?: (bytesUploaded: number, totalBytes: number) => void;
  fetcher?: typeof fetch;
  chunkSize?: number;
  resumeUrl?: string;
  onUploadUrl?: (url: string) => void;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function offsetFrom(response: Response, max: number) {
  const value = response.headers.get("upload-offset");
  const offset = value == null ? NaN : Number(value);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > max)
    throw new Error("Bunny returned an invalid byte offset. Please try the upload again.");
  return offset;
}

export async function uploadCommunityVideo(
  file: File,
  session: BunnyUploadSession,
  { signal, onProgress, fetcher = fetch, chunkSize = 5 * 1024 * 1024, resumeUrl, onUploadUrl }: BunnyUploadOptions = {},
) {
  const endpoint = new URL(session.endpoint);
  if (endpoint.protocol !== "https:" || endpoint.hostname !== "video.bunnycdn.com" || endpoint.pathname !== "/tusupload")
    throw new Error("The video upload destination is invalid.");
  const auth = {
    AuthorizationSignature: session.signature,
    AuthorizationExpire: String(session.expiresAt),
    VideoId: session.videoId,
    LibraryId: String(session.libraryId),
    "Tus-Resumable": "1.0.0",
  };
  const base64 = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  let uploadUrl: URL;
  let offset: number;
  if (resumeUrl) {
    uploadUrl = new URL(resumeUrl);
    offset = 0;
  } else {
    const created = await fetcher(endpoint.toString(), {
      method: "POST",
      headers: {
        ...auth,
        "Upload-Length": String(file.size),
        "Upload-Metadata": `filetype ${base64(file.type)},title ${base64(file.name.slice(0, 180))},thumbnailTime ${base64("750")}`,
      },
      credentials: "omit",
      signal,
    });
    if (!created.ok) throw new Error(`Bunny could not start the video upload (${created.status}).`);
    const location = created.headers.get("location");
    if (!location) throw new Error("Bunny did not return an upload location.");
    uploadUrl = new URL(location, endpoint);
    offset = created.headers.has("upload-offset") ? offsetFrom(created, file.size) : 0;
  }
  if (uploadUrl.protocol !== "https:" || uploadUrl.hostname !== endpoint.hostname || !uploadUrl.pathname.startsWith("/tusupload/"))
    throw new Error("Bunny returned an invalid upload location.");
  onUploadUrl?.(uploadUrl.toString());

  async function remoteOffset() {
    const response = await fetcher(uploadUrl.toString(), {
      method: "HEAD",
      headers: auth,
      credentials: "omit",
      signal,
    });
    if (!response.ok) throw new Error(`Bunny could not resume the upload (${response.status}).`);
    const storedLength = Number(response.headers.get("upload-length"));
    if (storedLength !== file.size)
      throw new Error("The selected file does not match the interrupted upload.");
    return offsetFrom(response, file.size);
  }
  async function confirmedOffset() {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await remoteOffset(); }
      catch (error) {
        if (signal?.aborted) throw new Error("Video upload cancelled.");
        const transient = error instanceof Error && /\((429|5\d\d)\)/.test(error.message);
        if (!transient || attempt === 3) throw error;
        await pause((attempt + 1) * 1000);
      }
    }
    throw new Error("Bunny status is temporarily unavailable.");
  }
  if (resumeUrl) offset = await confirmedOffset();
  onProgress?.(offset, file.size);

  while (offset < file.size) {
    if (signal?.aborted) throw new Error("Video upload cancelled.");
    let accepted = false;
    let lastError = "The network interrupted this upload.";
    for (let attempt = 0; attempt < 4 && !accepted; attempt += 1) {
      let fatal = false;
      try {
        const end = Math.min(offset + chunkSize, file.size);
        const response = await fetcher(uploadUrl.toString(), {
          method: "PATCH",
          headers: { ...auth, "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" },
          credentials: "omit",
          body: file.slice(offset, end),
          signal,
        });
        if (response.status === 204) {
          const next = offsetFrom(response, file.size);
          if (next <= offset || next > end) throw new Error("Bunny did not acknowledge the uploaded bytes.");
          offset = next;
          onProgress?.(offset, file.size);
          accepted = true;
          break;
        }
        lastError = `Bunny rejected part of the video (${response.status}).`;
        if (response.status >= 400 && response.status < 500 && ![409, 423].includes(response.status))
          fatal = true;
      } catch (error) {
        if (signal?.aborted) throw new Error("Video upload cancelled.");
        lastError = error instanceof Error ? error.message : lastError;
      }
      if (fatal) throw new Error(lastError);
      // A PATCH can succeed even if its response is lost. Ask Bunny where the
      // persisted upload ended before sending that part again.
      try {
        const persisted = await confirmedOffset();
        if (persisted > offset) {
          offset = persisted;
          onProgress?.(offset, file.size);
          accepted = true;
          break;
        }
      } catch (error) {
        if (signal?.aborted) throw new Error("Video upload cancelled.");
        lastError = error instanceof Error ? error.message : lastError;
      }
      if (!accepted && attempt < 3) await pause((attempt + 1) * 1000);
    }
    if (!accepted) throw new Error(`${lastError} Please check your connection and try again.`);
  }
  // Bunny can return a transient 503 on HEAD immediately after accepting the
  // last PATCH. Keep the acknowledged bytes as a saved draft; server-side
  // reconciliation still requires Bunny's actual encoding status before post.
  try {
    if (await confirmedOffset() !== file.size)
      throw new Error("Bunny did not confirm the complete video upload. Please try again.");
    return true;
  } catch (error) {
    if (error instanceof Error && /\((429|5\d\d)\)/.test(error.message)) return false;
    throw error;
  }
}
