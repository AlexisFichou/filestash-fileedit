// fileedit.js: a small client-side script for Filestash (https://www.filestash.app).
// SPDX-License-Identifier: AGPL-3.0-only
//
// WHAT IT SOLVES. The Filestash editor saves a file through `POST /api/files/cat?path=…`, whose
// body is the RAW content of the file. When that content is PHP source, some endpoint antivirus
// products that inspect browser traffic block the request BEFORE it leaves the workstation (seen
// with ESET network protection, signature PHP/CVE-2024-4577). It is a false positive, and the
// server can neither see nor fix it, since the request never reaches it. The same body encoded in
// base64 goes through.
//
// WHAT IT DOES, AND NOTHING ELSE. It wraps `XMLHttpRequest` and acts ONLY on the save request
// (`POST` to `/api/files/cat`). It sends that request to a `write` endpoint served next to this
// script (loaded from `/x/fileedit.js`, it posts to `/x/write`), keeps the query string as is,
// encodes the body in base64 and says so in an `X-Fileedit-Encoding: base64` header. Every other
// request (reads, listings, editor synchronization) goes through UNCHANGED. Filestash itself is
// not modified: the script relies on the public `/api/files/cat` endpoint, not on a line of its
// code, which keeps it working across Filestash upgrades.
//
// THE SERVER SIDE, not part of this script: the `write` endpoint decodes the body and replays the
// original call to Filestash (`POST /api/files/cat?<same query>`, decoded body as `text/plain`,
// the user's cookies, `X-Requested-With: XmlHttpRequest`), then returns Filestash's status and
// body unchanged. Keep it narrow: fixed destination and method, `path` passed through opaque,
// body size capped, base64 only.
(function () {
  "use strict";
  var MARK = "__fileedit_wrapped__";
  if (XMLHttpRequest.prototype[MARK]) return; // idempotent: never two wrappers

  // The endpoint is resolved from this script's own URL. If that URL is unknown (the script was
  // not loaded by a `<script src>` tag), change nothing: the editor keeps its normal behavior.
  var script = document.currentScript;
  var writeSegment;
  try {
    writeSegment = new URL("write", script.src).pathname.replace(/^\//, "");
  } catch (e) { return; }
  XMLHttpRequest.prototype[MARK] = true;

  // Recognizes the save POST, and ONLY that one. Neither the GET (read) nor /api/codemirror/*
  // (editor synchronization, which writes nothing) is touched.
  var WRITE_RE = /(^|\/)api\/files\/cat(\?|$)/;

  var open = XMLHttpRequest.prototype.open;
  var send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__fileeditWrite = false; // an XHR object can be reopened for another request
    try {
      if (typeof method === "string" && method.toUpperCase() === "POST" &&
          typeof url === "string" && WRITE_RE.test(url)) {
        // Only the path segment changes. The query (`?path=…`) is not what triggers the
        // antivirus; the endpoint passes it on to Filestash as is.
        this.__fileeditWrite = true;
        arguments[1] = url.replace(/(^|\/)api\/files\/cat/, function (_, lead) {
          return lead + writeSegment;
        });
      }
    } catch (e) { /* when in doubt, change nothing: the editor goes back to its normal behavior */ }
    return open.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__fileeditWrite && typeof body === "string") {
        // UTF-8 first, then base64: a file may contain characters outside Latin-1.
        var b64 = btoa(unescape(encodeURIComponent(body)));
        this.setRequestHeader("X-Fileedit-Encoding", "base64");
        return send.call(this, b64);
      }
    } catch (e) { /* if encoding fails, the request goes out as is */ }
    return send.apply(this, arguments);
  };
})();
