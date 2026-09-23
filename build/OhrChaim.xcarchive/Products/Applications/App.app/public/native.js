/*
 * native.js — Ohr Chaim Capacitor integration layer.
 *
 * Loaded ONLY inside the iOS/Android app (build.mjs injects the script tag into
 * www/index.html; the deployed website never loads it). On the web it would
 * no-op anyway because window.Capacitor is absent.
 *
 * Plugins are accessed through the Capacitor bridge (window.Capacitor.Plugins.*)
 * rather than via bundled ES modules, so the no-build CDN frontend stays intact.
 * The matching native plugins are installed as npm deps and linked by `cap sync`.
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return; // web: no-op
  var P = Cap.Plugins || {};
  var BACKEND = window.__BACKEND_URL__ || 'https://ohrchaim.org';

  function call(name, method, args) {
    try {
      if (P[name] && typeof P[name][method] === 'function') return P[name][method](args || {});
    } catch (e) { console.warn('[native]', name + '.' + method, e); }
    return Promise.resolve(null);
  }

  /* ---- Status bar: light text to sit on the navy brand header ---- */
  // Capacitor Style 'DARK' = light content (for dark backgrounds).
  call('StatusBar', 'setStyle', { style: 'DARK' });

  /* ---- Splash screen: hide once the app has painted ---- */
  function hideSplash() { call('SplashScreen', 'hide'); }
  if (document.readyState === 'complete') setTimeout(hideSplash, 500);
  else window.addEventListener('load', function () { setTimeout(hideSplash, 500); });

  /* ---- Push notifications: shul announcements ---- */
  function registerPush() {
    if (!P.PushNotifications) return;
    P.PushNotifications.addListener('registration', function (t) {
      try {
        fetch(BACKEND + '/api/push/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: t.value, platform: Cap.getPlatform() })
        }).catch(function () {});
        try { localStorage.setItem('ohrchaim_push_token', t.value); } catch (e) {}
      } catch (e) {}
    });
    P.PushNotifications.addListener('registrationError', function (e) {
      console.warn('[native] push registration error', e);
    });
    // Tapped a push -> deep-link to the relevant page via the URL hash.
    P.PushNotifications.addListener('pushNotificationActionPerformed', function (a) {
      var data = a && a.notification && a.notification.data;
      if (data && data.url) window.location.hash = data.url;
    });
    call('PushNotifications', 'checkPermissions').then(function (perm) {
      if (perm && perm.receive === 'granted') return call('PushNotifications', 'register');
      return call('PushNotifications', 'requestPermissions').then(function (req) {
        if (req && req.receive === 'granted') return call('PushNotifications', 'register');
      });
    });
  }

  /* ---- Local notifications: on-device davening + Shabbos reminders ----
   * Fire even when offline / app-closed. The list is normalized server-side
   * from the existing zmanim engine (GET /api/native/reminders). */
  function setupLocalReminders() {
    if (!P.LocalNotifications) return;
    P.LocalNotifications.addListener && P.LocalNotifications.addListener(
      'localNotificationActionPerformed', function (a) {
        var extra = a && a.notification && a.notification.extra;
        if (extra && extra.url) window.location.hash = extra.url;
      });
    call('LocalNotifications', 'checkPermissions').then(function (perm) {
      if (perm && perm.display === 'granted') return scheduleReminders();
      return call('LocalNotifications', 'requestPermissions').then(function (req) {
        if (req && req.display === 'granted') return scheduleReminders();
      });
    });
  }

  function scheduleReminders() {
    return fetch(BACKEND + '/api/native/reminders')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.reminders) || !data.reminders.length) return;
        // Replace our own previously-scheduled reminders (id range 1000-1999).
        return call('LocalNotifications', 'getPending').then(function (p) {
          var existing = ((p && p.notifications) || [])
            .filter(function (n) { return n.id >= 1000 && n.id < 2000; })
            .map(function (n) { return { id: n.id }; });
          var clear = existing.length
            ? call('LocalNotifications', 'cancel', { notifications: existing })
            : Promise.resolve();
          return clear.then(function () {
            var notifs = data.reminders.slice(0, 32).map(function (rm, i) {
              var at = new Date(rm.at);
              return {
                id: 1000 + i,
                title: rm.title || 'Congregation Ohr Chaim',
                body: rm.body || '',
                schedule: { at: at },
                extra: rm.url ? { url: rm.url } : undefined
              };
            }).filter(function (n) {
              return n.schedule.at && !isNaN(n.schedule.at.getTime()) &&
                     n.schedule.at.getTime() > (new Date()).getTime();
            });
            if (notifs.length) return call('LocalNotifications', 'schedule', { notifications: notifs });
          });
        });
      })
      .catch(function () {});
  }

  /* ---- Re-sync reminders whenever the app returns to the foreground ---- */
  if (P.App && P.App.addListener) {
    P.App.addListener('appStateChange', function (s) {
      if (s && s.isActive) scheduleReminders();
    });
  }

  /* ---- Helpers the web app can call when running natively ---- */
  // Native share sheet (schedule / event / donation link).
  window.__nativeShare__ = function (opts) {
    opts = opts || {};
    return call('Share', 'share', {
      title: opts.title || 'Congregation Ohr Chaim',
      text: opts.text || '',
      url: opts.url || 'https://ohrchaim.org',
      dialogTitle: 'Share'
    });
  };
  // Light haptic tap.
  window.__haptic__ = function (style) { return call('Haptics', 'impact', { style: style || 'LIGHT' }); };

  /* ---- Boot ---- */
  registerPush();
  setupLocalReminders();
})();
