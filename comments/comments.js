/* GitHub-Issues-backed comment "guestbook" widget.
 * - Displays historical comments by reading the GitHub API directly (no token).
 * - Auto-scrolls the history like a marquee (pauses on hover).
 * - Posts through a local proxy (port 7897) that holds the GitHub token,
 *   so comments are written to the issue WITHOUT leaving the page.
 * No nickname input is required; configure via window.COMMENTS_CONFIG. */
(function () {
  'use strict';
  var CFG = window.COMMENTS_CONFIG || {};
  var REPO  = CFG.repo  || 'greasebig/greasebig.github.io';
  var ISSUE = CFG.issue || 1;
  var PROXY = CFG.proxy || 'http://localhost:7897';
  var MAX   = CFG.max   || 100;
  var TITLE = CFG.title || '留言墙 / Guestbook';
  var BRANCH = CFG.branch || 'main';   // branch that hosts comments/data.json
  var API   = 'https://api.github.com';

  // Fallback samples so the scroll is visible before the issue is seeded.
  var SAMPLES = [
    { user: { login: 'Nova' }, created_at: '2026-08-20T09:00:00Z', body: '这个每日论文聚合站太好用了，每天早上来刷一下新进展 🚀' },
    { user: { login: '阿杰' }, created_at: '2026-08-21T14:30:00Z', body: 'World Model 那一块 updates 很及时，关注很久了！' },
    { user: { login: 'Mika' }, created_at: '2026-08-22T20:10:00Z', body: '配色和玻璃拟态风格好看，加载也快。留个言试试滚动～' },
    { user: { login: '小鹿' }, created_at: '2026-08-23T08:05:00Z', body: '希望以后能加搜索功能，按关键词过滤论文就好啦。' }
  ];

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function md(src) {
    var s = esc(src);
    s = s.replace(/```([\s\S]*?)```/g, function (_, c) { return '<pre><code>' + c.replace(/^\n|\n$/g, '') + '</code></pre>'; });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, t, u) { return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; });
    s = s.replace(/\n/g, '<br>');
    return s;
  }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso; } }
  function initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

  function renderComment(c) {
    var item = el('<div class="gh-comments__item"></div>');
    var av;
    if (c.user && c.user.avatar_url) {
      av = document.createElement('img');
      av.className = 'gh-comments__avatar';
      av.src = c.user.avatar_url; av.alt = ''; av.width = 40; av.height = 40;
    } else {
      av = document.createElement('div');
      av.className = 'gh-comments__avatar gh-comments__avatar--letter';
      av.textContent = initial(c.user && c.user.login);
    }
    item.appendChild(av);
    var main = document.createElement('div');
    main.style.flex = '1';
    main.innerHTML =
      '<div class="gh-comments__meta"><span class="gh-comments__author">' + esc(c.user ? c.user.login : 'anonymous') + '</span> · ' + esc(fmtDate(c.created_at)) + '</div>' +
      '<div class="gh-comments__body">' + md(c.body) + '</div>';
    item.appendChild(main);
    return item;
  }

  function buildTrack(items, scrollView) {
    scrollView.innerHTML = '';
    if (!items.length) { scrollView.innerHTML = '<div class="gh-comments__empty">还没有留言，来抢沙发吧！ / No comments yet.</div>'; return; }
    var track = el('<div class="gh-comments__track"></div>');
    items.forEach(function (c) { track.appendChild(renderComment(c)); });
    items.forEach(function (c) { track.appendChild(renderComment(c)); }); // duplicate for seamless loop
    scrollView.appendChild(track);
    if (track.scrollHeight / 2 <= scrollView.clientHeight) {
      track.style.animation = 'none';
    } else {
      track.style.animationDuration = Math.max(24, items.length * 6) + 's';
    }
  }

  function init(root) {
    root.classList.add('gh-comments');
    root.innerHTML =
      '<h2 class="gh-comments__title">' + esc(TITLE) + '</h2>' +
      '<p class="gh-comments__sub" id="gc-sub">由 GitHub Issues 提供支持的留言墙 · Powered by GitHub Issues</p>' +
      '<div class="gh-comments__scroll" id="gc-scroll"></div>' +
      '<form class="gh-comments__form" id="gc-form">' +
        '<textarea id="gc-body" maxlength="2000" placeholder="说点什么… / Leave a message" required></textarea>' +
        '<input class="gh-comments__hp" id="gc-hp" type="text" tabindex="-1" autocomplete="off">' +
        '<div class="gh-comments__row">' +
          '<button class="gh-comments__submit" type="submit">发布留言 / Post</button>' +
          '<span class="gh-comments__status" id="gc-status"></span>' +
        '</div>' +
      '</form>';

    var scrollView = root.querySelector('#gc-scroll');
    var form = root.querySelector('#gc-form');
    var bodyEl = root.querySelector('#gc-body');
    var hpEl = root.querySelector('#gc-hp');
    var statusEl = root.querySelector('#gc-status');
    var subEl = root.querySelector('#gc-sub');

    function setStatus(msg, kind) {
      statusEl.textContent = msg || '';
      statusEl.className = 'gh-comments__status' + (kind ? ' gh-comments__status--' + kind : '');
    }

    function load() {
      // File-backed store: read comments/data.json straight from the repo
      // (raw.githubusercontent serves it with CORS *, no token needed).
      var url = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/comments/data.json';
      fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (arr) {
          if (Array.isArray(arr) && arr.length) {
            subEl.textContent = '由 GitHub 仓库留言文件提供支持 · Powered by repo file';
            buildTrack(arr, scrollView);
          } else {
            subEl.textContent = '还没有留言，来抢沙发吧！ / No comments yet.';
            buildTrack(SAMPLES, scrollView);
          }
        })
        .catch(function () {
          subEl.textContent = '示例数据（无法加载）· 运行代理后即可显示真实留言';
          buildTrack(SAMPLES, scrollView);
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (hpEl.value) return; // spam honeypot
      var body = bodyEl.value.trim();
      if (!body) { setStatus('请填写留言 / Write something', 'err'); return; }
      var btn = form.querySelector('.gh-comments__submit');
      btn.disabled = true; setStatus('发布中… / Posting…');
      fetch(PROXY + '/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: ISSUE, body: body })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (!res.ok) throw new Error((res.j && res.j.error) ? res.j.error : 'post failed');
          bodyEl.value = '';
          setStatus('已发布！ / Posted!', 'ok');
          load();
        })
        .catch(function (err) {
          btn.disabled = false;
          var m = (err && err.message) ? err.message : 'unknown error';
          var hint = (/fetch|network|refused|connect|load/i.test(m))
            ? '｜本机留言代理未启动：请先运行 start-proxy.bat 并设置 GITHUB_TOKEN（需代理的网络另设 HTTPS_PROXY）'
            : '';
          setStatus('发布失败 / Failed: ' + m + hint, 'err');
        });
    });

    load();
  }

  function boot() {
    var root = document.getElementById('comments') || document.getElementById('gh-comments');
    if (!root) { root = document.createElement('div'); root.id = 'gh-comments'; document.body.appendChild(root); }
    init(root);
  }
  if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
