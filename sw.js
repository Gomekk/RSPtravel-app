// 男気じゃんけん旅 Service Worker
// 画面ファイルは常にネットから最新を取り、オフラインのときだけ保存済みを使う。Supabaseなど外部への通信には手を出さない
const CACHE = "ojk-v81";
const FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== "ojk-badge").map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});

// プッシュ通知
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    await self.registration.showNotification(d.title || "男気じゃんけん旅", {
      body: d.body || "", tag: d.tag || undefined, icon: "icon-192.png", badge: "icon-192.png", data: { url: "./" }
    });
    // ホーム画面のアイコンに未読件数のバッジを付ける
    try {
      const c = await caches.open("ojk-badge"), r = await c.match("/badge");
      const n = (r ? Number(await r.text()) || 0 : 0) + 1;
      await c.put("/badge", new Response(String(n)));
      if (self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
    } catch (err) {}
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => { try { if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge(); const c = await caches.open("ojk-badge"); await c.put("/badge", new Response("0")); } catch (err) {} })());
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
