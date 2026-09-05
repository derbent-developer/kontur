/* Kontur — интерактив сайта */
(function () {
  'use strict';

  /* ---------- Логотип: убираем белый фон и лишние поля ----------
     Исходник с Яндекс Карт — JPEG (чёрная надпись на белом). Пересобираем
     его в PNG с альфа-каналом, чтобы логотип корректно ложился на любой фон. */
  function cleanLogo(img) {
    if (img.dataset.done) return;
    img.dataset.done = '1';

    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;

    try {
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      var data = ctx.getImageData(0, 0, w, h);
      var px = data.data;
      var minX = w, minY = h, maxX = -1, maxY = -1;

      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var i = (y * w + x) * 4;
          var lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          var a = 255 - lum;              // чем темнее пиксель, тем он непрозрачнее
          if (a < 16) {
            a = 0;                        // фон и лёгкий шум JPEG — в прозрачность
          } else {
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
          px[i + 3] = a;
          if (a > 40) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) return;

      ctx.putImageData(data, 0, 0);

      var pad = Math.round(Math.max(w, h) * 0.02);
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(w - 1, maxX + pad);
      maxY = Math.min(h - 1, maxY + pad);

      var cw = maxX - minX + 1, ch = maxY - minY + 1;
      var out = document.createElement('canvas');
      out.width = cw; out.height = ch;
      out.getContext('2d').drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);

      img.src = out.toDataURL('image/png');
      img.classList.add('is-clean');
    } catch (e) {
      /* canvas недоступен — остаётся CSS-фолбэк mix-blend-mode: multiply */
    }
  }

  document.querySelectorAll('img[data-logo]').forEach(function (img) {
    if (img.complete && img.naturalWidth) cleanLogo(img);
    else img.addEventListener('load', function () { cleanLogo(img); }, { once: true });
  });

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Один слушатель скролла на всё ----------
     Всё, что зависит от прокрутки, считается в одном rAF-кадре:
     на телефоне это заметно экономит батарею и не даёт анимациям дёргаться. */
  var header = document.getElementById('header');
  var progress = document.getElementById('progress');
  var mobileBar = document.getElementById('mobileBar');
  var hero = document.getElementById('hero');
  var parallaxItems = Array.prototype.slice.call(document.querySelectorAll('.parallax'));

  var lastY = window.scrollY;
  var ticking = false;

  function frame() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    /* шапка: липнет и прячется при движении вниз */
    header.classList.toggle('is-stuck', y > 40);
    var menuOpen = document.getElementById('mobileMenu').classList.contains('is-open');
    header.classList.toggle('is-hidden', !menuOpen && y > 320 && y > lastY + 4);

    /* индикатор прочитанного */
    if (progress) {
      var max = document.documentElement.scrollHeight - vh;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    }

    /* панель «Позвонить / WhatsApp» — после первого экрана */
    if (mobileBar) {
      mobileBar.classList.toggle('is-up', y > (hero ? hero.offsetHeight * 0.6 : 400));
    }

    /* параллакс: сдвиг относительно центра экрана */
    if (!reduced) {
      for (var i = 0; i < parallaxItems.length; i++) {
        var el = parallaxItems[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        var progressInView = (r.top + r.height / 2 - vh / 2) / vh;
        var shift = progressInView * (parseFloat(el.dataset.speed) || 0) * vh;
        el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      }
    }

    lastY = y;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* вкладка была в фоне — кадры не считались; пересчитываем при возврате */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { lastY = window.scrollY; onScroll(); }
  });
  window.addEventListener('pageshow', onScroll);

  frame();

  /* ---------- Mobile menu ---------- */
  var burger = document.getElementById('burger');
  var menu = document.getElementById('mobileMenu');

  function closeMenu() {
    burger.classList.remove('is-open');
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
  }

  burger.addEventListener('click', function () {
    var open = menu.classList.toggle('is-open');
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
  });

  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });

  /* ---------- Появление при прокрутке ---------- */
  var items = document.querySelectorAll('.reveal, .unveil');

  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -12% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* Страховка: что бы ни случилось с наблюдателем, контент выше линии сгиба
     не должен остаться невидимым. */
  window.addEventListener('load', function () {
    setTimeout(function () {
      items.forEach(function (el) {
        if (!el.classList.contains('is-in') &&
            el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('is-in');
        }
      });
    }, 2000);
  });

  /* ---------- Счётчики ----------
     Числа в блоках статистики докручиваются, когда блок появляется. */
  function animateCount(el) {
    var target = el.dataset.count;
    var num = parseFloat(target.replace(',', '.'));
    if (isNaN(num)) return;
    var suffix = target.replace(/[\d.,]/g, '');
    var decimals = (target.indexOf(',') > -1) ? 1 : 0;
    var start = performance.now();
    var dur = 1100;

    function step(now) {
      var t = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      var value = (num * eased).toFixed(decimals).replace('.', ',');
      el.textContent = value + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduced) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          co.unobserve(e.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---------- Reviews: show all ---------- */
  var moreBtn = document.getElementById('moreReviews');
  var reviewsGrid = document.getElementById('reviewsGrid');

  if (moreBtn && reviewsGrid) {
    moreBtn.addEventListener('click', function () {
      var expanded = reviewsGrid.classList.toggle('is-expanded');

      if (expanded) {
        /* показываем разом, но с лёгким каскадом — чтобы не «выпрыгивало» */
        var hidden = document.querySelectorAll('.review.is-hidden');
        hidden.forEach(function (r, i) {
          r.classList.remove('is-hidden');
          r.style.setProperty('--d', Math.min(i * 0.03, 0.4) + 's');
          requestAnimationFrame(function () { r.classList.add('is-in'); });
        });
        moreBtn.textContent = 'Свернуть отзывы';
      } else {
        document.querySelectorAll('.review').forEach(function (r, i) {
          if (i >= 6) r.classList.add('is-hidden');
        });
        moreBtn.textContent = 'Показать все 33 отзыва';
        document.getElementById('reviews').scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ---------- Lightbox ---------- */
  var grid = document.getElementById('galleryGrid');
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var shots = grid ? Array.prototype.slice.call(grid.querySelectorAll('img')) : [];
  var current = 0;

  function show(i) {
    current = (i + shots.length) % shots.length;
    lbImg.src = shots[current].src;
    lbImg.alt = shots[current].alt;
  }

  function openLb(i) {
    show(i);
    lb.classList.add('is-open');
    document.body.classList.add('is-locked');
  }

  function closeLb() {
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
  }

  shots.forEach(function (img, i) {
    img.parentElement.addEventListener('click', function () { openLb(i); });
  });

  document.getElementById('lbClose').addEventListener('click', closeLb);
  document.getElementById('lbPrev').addEventListener('click', function (e) { e.stopPropagation(); show(current - 1); });
  document.getElementById('lbNext').addEventListener('click', function (e) { e.stopPropagation(); show(current + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  /* ---------- Phone mask ---------- */
  var phone = document.getElementById('f-phone');
  if (phone) {
    phone.addEventListener('input', function () {
      var d = phone.value.replace(/\D/g, '');
      if (d[0] === '8') d = '7' + d.slice(1);
      if (d[0] !== '7') d = '7' + d;
      d = d.slice(0, 11);
      var out = '+7';
      if (d.length > 1) out += ' (' + d.slice(1, 4);
      if (d.length >= 5) out += ') ' + d.slice(4, 7);
      if (d.length >= 8) out += '-' + d.slice(7, 9);
      if (d.length >= 10) out += '-' + d.slice(9, 11);
      phone.value = out;
    });
  }

  /* ---------- Booking form → WhatsApp ---------- */
  var form = document.getElementById('bookingForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var tel = form.phone.value.trim();
      var service = form.service.value;
      var msg = form.message.value.trim();

      var text =
        'Здравствуйте! Хочу записаться в Kontur.\n' +
        'Имя: ' + name + '\n' +
        'Телефон: ' + tel + '\n' +
        'Услуга: ' + service +
        (msg ? '\nКомментарий: ' + msg : '');

      window.open('https://wa.me/79187360336?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  }

  /* ---------- Footer year ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
