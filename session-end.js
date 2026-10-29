// session-end.js: a small client-side script for Filestash (https://www.filestash.app).
// SPDX-License-Identifier: AGPL-3.0-only
//
// WHAT IT SOLVES. Some deployments never let a visitor log in through Filestash's own form: a
// gateway on the server side opens the session on the user's behalf, and the server refuses
// `POST /api/session` from the outside. When that session ends (expired, or « logout »), the front
// end does not ask the server for `/login`: it moves there with its own router
// (`history.pushState`) and draws a form that can only fail.
//
// WHAT IT DOES, AND NOTHING ELSE. It wraps `history.pushState` and `history.replaceState`: a move to
// `/login` becomes a real page load of `/login`, so the SERVER answers it (for instance with a
// redirect to the place where sessions are opened). Every other navigation goes through
// UNCHANGED. Filestash itself is not modified, and if a later version stopped going through
// `history`, the form would simply show again.
//
// THE SERVER SIDE, not part of this script: answer `GET /login` yourself (a redirect), and refuse
// writes on `/api/session` from the outside. Load this script before the front end's own modules
// (a classic `<script>` at the end of the `<head>` runs before them).
(function () {
  "use strict";
  var MARK = "__session_end_wrapped__";
  if (window[MARK]) return; // idempotent: never two wrappers
  window[MARK] = true;

  function isLogin(url) {
    try {
      var path = new URL(String(url), location.href).pathname.replace(/\/+$/, "");
      return path === "/login" || path.indexOf("/login/") === 0;
    } catch (e) {
      return false;
    }
  }

  // Already on `/login`: the server did not take it. Wrapping here could loop on the front end's
  // own `replaceState("/login?…")`, so the page is left as it is.
  if (isLogin(location.href)) return;

  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    if (typeof original !== "function") return;
    history[name] = function (state, title, url) {
      if (url != null && isLogin(url)) {
        location.replace("/login");
        return;
      }
      return original.apply(this, arguments);
    };
  });
})();
