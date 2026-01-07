/* =========================
   /js/cookies.js
   Cookies utils + segmented storage
   (cookies only, no localStorage)
   ========================= */

(function () {
  "use strict";

  // ---- Basic cookie helpers ----
  function setCookie(name, value, days = 30, path = "/") {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    // SameSite=Lax works well for most cases
    document.cookie =
      encodeURIComponent(name) +
      "=" +
      encodeURIComponent(value) +
      "; expires=" +
      expires +
      "; path=" +
      path +
      "; SameSite=Lax";
  }

  function getCookie(name) {
    const n = encodeURIComponent(name) + "=";
    const parts = document.cookie.split("; ");
    for (const p of parts) {
      if (p.startsWith(n)) return decodeURIComponent(p.slice(n.length));
    }
    return null;
  }

  function deleteCookie(name, path = "/") {
    document.cookie =
      encodeURIComponent(name) +
      "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=" +
      path +
      "; SameSite=Lax";
  }

  // ---- Encoding helpers (safe for cookies) ----
  function toBase64(str) {
    // handle unicode
    return btoa(unescape(encodeURIComponent(str)));
  }

  function fromBase64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  // ---- Segmented cookie storage for objects ----
  // Each cookie has ~4KB limit. We chunk base64 string into multiple cookies:
  // key__meta + key__0, key__1, ...
  // meta stores: { v: 1, parts: N, ts: number }
  const VERSION = 1;
  const CHUNK_SIZE = 2800; // safe chunk size (avoid hitting 4096 limit with name + attributes)

  function setObject(key, obj, days = 30) {
    try {
      const json = JSON.stringify(obj ?? {});
      const b64 = toBase64(json);

      const parts = Math.max(1, Math.ceil(b64.length / CHUNK_SIZE));
      for (let i = 0; i < parts; i++) {
        const chunk = b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        setCookie(`${key}__${i}`, chunk, days);
      }

      const meta = { v: VERSION, parts, ts: Date.now() };
      setCookie(`${key}__meta`, JSON.stringify(meta), days);

      // cleanup any old leftover chunks if parts decreased
      let extraIndex = parts;
      while (getCookie(`${key}__${extraIndex}`) !== null) {
        deleteCookie(`${key}__${extraIndex}`);
        extraIndex++;
        if (extraIndex > 200) break; // safety
      }

      return true;
    } catch (e) {
      console.error("setObject failed:", e);
      return false;
    }
  }

  function getObject(key) {
    const metaRaw = getCookie(`${key}__meta`);
    if (!metaRaw) return null;

    let meta;
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      return null;
    }

    if (!meta || typeof meta.parts !== "number" || meta.parts < 1) return null;

    let b64 = "";
    for (let i = 0; i < meta.parts; i++) {
      const part = getCookie(`${key}__${i}`);
      if (part == null) return null;
      b64 += part;
    }

    try {
      const json = fromBase64(b64);
      return JSON.parse(json);
    } catch (e) {
      console.error("getObject decode failed:", e);
      return null;
    }
  }

  function deleteObject(key) {
    deleteCookie(`${key}__meta`);
    let i = 0;
    while (getCookie(`${key}__${i}`) !== null) {
      deleteCookie(`${key}__${i}`);
      i++;
      if (i > 200) break; // safety
    }
  }

  // ---- Public API ----
  window.CookieStore = {
    setCookie,
    getCookie,
    deleteCookie,
    setObject,
    getObject,
    deleteObject,
  };
})();
