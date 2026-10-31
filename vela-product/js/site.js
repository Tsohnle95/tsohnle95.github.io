(function () {
  'use strict';

  // Install tabs + copy command
  document.querySelectorAll('[data-install]').forEach(function (box) {
    var buttons = Array.prototype.slice.call(box.querySelectorAll('.tabs [data-cmd]'));
    var code = box.querySelector('[data-cmd-text]');
    var copy = box.querySelector('[data-copy]');

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
        btn.setAttribute('aria-selected', 'true');
        if (code) code.textContent = btn.getAttribute('data-cmd');
        if (copy) {
          copy.textContent = 'COPY';
          copy.style.color = '';
        }
      });
    });

    if (copy && code) {
      copy.addEventListener('click', function () {
        var text = code.textContent;
        function ok() {
          copy.textContent = 'COPIED';
          copy.style.color = 'var(--teal)';
          setTimeout(function () { copy.textContent = 'COPY'; copy.style.color = ''; }, 1500);
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(ok).catch(ok);
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta);
          ok();
        }
      });
    }
  });

  // Rail selection
  document.querySelectorAll('.rail').forEach(function (rail) {
    var buttons = Array.prototype.slice.call(rail.querySelectorAll('button'));
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
      });
    });
  });

  // Subtle hero entrance
  var inner = document.querySelector('.hero-inner');
  if (inner) {
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(10px)';
    inner.style.transition = 'opacity .8s ease, transform .8s cubic-bezier(.2,.8,.2,1)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        inner.style.opacity = '1';
        inner.style.transform = 'none';
      });
    });
  }
  // Explorer hover preview
  var explorer = document.querySelector('.rail button[data-label="Explorer"]');
  var workspacePreview = document.getElementById('workspacePreview');
  if (explorer && workspacePreview) {
    var showWorkspace = function () {
      workspacePreview.classList.add('show');
      workspacePreview.setAttribute('aria-hidden', 'false');
      explorer.classList.add('is-previewing');
    };
    var hideWorkspace = function () {
      workspacePreview.classList.remove('show');
      workspacePreview.setAttribute('aria-hidden', 'true');
      explorer.classList.remove('is-previewing');
    };
    explorer.addEventListener('pointerenter', showWorkspace);
    explorer.addEventListener('pointerleave', hideWorkspace);
    explorer.addEventListener('focus', showWorkspace);
    explorer.addEventListener('blur', hideWorkspace);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideWorkspace();
    });
  }

})();
