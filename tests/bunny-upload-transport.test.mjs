import test from "node:test";
import assert from "node:assert/strict";
import { uploadCommunityVideo } from "../src/lib/bunny-upload.ts";

const session = {
  endpoint: "https://video.bunnycdn.com/tusupload",
  signature: "temporary-signature",
  expiresAt: 2000000000,
  videoId: "11111111-1111-4111-8111-111111111111",
  libraryId: "12345",
};
const file = Object.assign(new Blob(["hello world!"], { type: "video/mp4" }), { name: "test.mp4" });
const reply = (status, headers = {}) => new Response(null, { status, headers });

test("Bunny upload sends required metadata, verifies chunk offsets, and confirms final bytes", async () => {
  const progress = [];
  const methods = [];
  let offset = 0;
  await uploadCommunityVideo(file, session, {
    chunkSize: 5,
    onProgress: (bytes) => progress.push(bytes),
    fetcher: async (url, init) => {
      methods.push(init.method);
      assert.equal(init.credentials, "omit");
      if (init.method === "POST") {
        assert.match(init.headers["Upload-Metadata"], /filetype [^,]+,title [^,]+,thumbnailTime [^,]+/);
        assert.equal(init.headers["Upload-Length"], String(file.size));
        return reply(201, { location: "/tusupload/abc" });
      }
      assert.equal(new URL(url).hostname, "video.bunnycdn.com");
      if (init.method === "HEAD") return reply(200, { "upload-offset": String(offset), "upload-length": String(file.size) });
      assert.equal(init.headers["Upload-Offset"], String(offset));
      offset += init.body.size;
      return reply(204, { "upload-offset": String(offset) });
    },
  });
  assert.deepEqual(methods, ["POST", "PATCH", "PATCH", "PATCH", "HEAD"]);
  assert.deepEqual(progress, [0, 5, 10, file.size]);
});

test("a lost PATCH response resumes from Bunny HEAD rather than repeating acknowledged bytes", async () => {
  let calls = 0;
  const progress = [];
  await uploadCommunityVideo(file, session, {
    chunkSize: file.size,
    onProgress: (bytes) => progress.push(bytes),
    fetcher: async (_url, init) => {
      calls++;
      if (init.method === "POST") return reply(201, { location: "/tusupload/abc", "upload-offset": "0" });
      if (init.method === "PATCH") throw new TypeError("Network response lost");
      return reply(200, { "upload-offset": String(file.size), "upload-length": String(file.size) });
    },
  });
  assert.equal(calls, 4); // POST, PATCH, recovery HEAD, final HEAD
  assert.deepEqual(progress, [0, file.size]);
});

test("never finalize an upload unless Bunny HEAD confirms every byte", async () => {
  await assert.rejects(uploadCommunityVideo(file, session, {
    chunkSize: file.size,
    fetcher: async (_url, init) => {
      if (init.method === "POST") return reply(201, { location: "/tusupload/abc", "upload-offset": "0" });
      if (init.method === "PATCH") return reply(204, { "upload-offset": String(file.size) });
      return reply(200, { "upload-offset": "0", "upload-length": String(file.size) });
    },
  }), /did not confirm the complete video upload/);
});

test("rejects a foreign TUS upload location before sending any file bytes", async () => {
  await assert.rejects(uploadCommunityVideo(file, session, {
    fetcher: async () => reply(201, { location: "https://example.org/collect", "upload-offset": "0" }),
  }), /invalid upload location/);
});

test("fatal Bunny 4xx does not loop or create repeated uploads", async () => {
  let patches = 0;
  await assert.rejects(uploadCommunityVideo(file, session, {
    fetcher: async (_url, init) => {
      if (init.method === "POST") return reply(201, { location: "/tusupload/abc", "upload-offset": "0" });
      if (init.method === "PATCH") { patches++; return reply(401); }
      throw new Error("No HEAD expected after fatal error");
    },
  }), /rejected part of the video \(401\)/);
  assert.equal(patches, 1);
});

test("resumes an interrupted upload from Bunny's confirmed offset without another POST", async () => {
  const methods = [];
  let stored = 5;
  await uploadCommunityVideo(file, session, {
    resumeUrl: "https://video.bunnycdn.com/tusupload/abc",
    chunkSize: 10,
    fetcher: async (_url, init) => {
      methods.push(init.method);
      if (init.method === "HEAD") return reply(200, { "upload-offset": String(stored), "upload-length": String(file.size) });
      assert.equal(init.headers["Upload-Offset"], "5");
      stored += init.body.size;
      return reply(204, { "upload-offset": String(stored) });
    },
  });
  assert.deepEqual(methods, ["HEAD", "PATCH", "HEAD"]);
});

test("refuses to resume when Bunny's stored source length differs from the selected file", async () => {
  await assert.rejects(uploadCommunityVideo(file, session, {
    resumeUrl: "https://video.bunnycdn.com/tusupload/abc",
    fetcher: async () => reply(200, { "upload-offset": "5", "upload-length": "999" }),
  }), /does not match the interrupted upload/);
});

test("a transient Bunny 503 immediately after complete PATCH is retried without re-uploading bytes", async () => {
  let heads = 0;
  let patches = 0;
  const verified = await uploadCommunityVideo(file, session, {
    chunkSize: file.size,
    fetcher: async (_url, init) => {
      if (init.method === "POST") return reply(201, { location: "/tusupload/abc" });
      if (init.method === "PATCH") { patches++; return reply(204, { "upload-offset": String(file.size) }); }
      heads++;
      return heads === 1 ? reply(503) : reply(200, { "upload-offset": String(file.size), "upload-length": String(file.size) });
    },
  });
  assert.equal(verified, true);
  assert.equal(patches, 1);
  assert.equal(heads, 2);
});

test("persistent Bunny 503 keeps acknowledged bytes as pending verification rather than deleting the draft", async () => {
  let patches = 0;
  const verified = await uploadCommunityVideo(file, session, {
    chunkSize: file.size,
    fetcher: async (_url, init) => {
      if (init.method === "POST") return reply(201, { location: "/tusupload/abc" });
      if (init.method === "PATCH") { patches++; return reply(204, { "upload-offset": String(file.size) }); }
      return reply(503);
    },
  });
  assert.equal(verified, false);
  assert.equal(patches, 1);
});
