/* Justice renderer — Knuth–Plass paragraph justification for the academic pages.
 *
 * Uses the bundled @kitlangton/justice engine (window.Justice) to choose line
 * breaks for a whole paragraph, then renders each line separately and fits it
 * to the column with word-spacing (verified against real DOM metrics).
 *
 * Plain classic script so it loads from file:// as well as a server.
 */
(function () {
  var J = window.Justice;
  if (!J) { console.warn('Justice: engine not loaded'); return; }

  // The renderer is self-contained: it brings the line styles it needs.
  // Lines use custom elements (not <span>) so they can't pick up descendant
  // selectors meant for inline markup, e.g. `p span { color: … }`.
  var style = document.createElement('style');
  style.textContent =
    'just-line{display:block}just-inner{display:inline-block;white-space:nowrap}[data-justified]{text-align:left}';
  (document.head || document.documentElement).appendChild(style);

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var registry = [];
  var scheduled = false;

  // Short, label-ish, or chrome elements are left ragged.
  var SKIP = /(^|\s)(links|meta|label|role|sub|kind|num|fig|term|r-index|jsub|kicker|up|head|identity|mail)(\s|$)/;
  var TARGETS = 'main p, main .service-line > span, main .services td:last-child, main .ref .note';

  function contentWidth(el) {
    var cs = getComputedStyle(el);
    var pl = parseFloat(cs.paddingLeft) || 0;
    var pr = parseFloat(cs.paddingRight) || 0;
    var w = el.clientWidth - pl - pr;
    if (w <= 0) w = el.getBoundingClientRect().width - pl - pr;
    return w;
  }

  function eligible(el) {
    if (el.hasAttribute('data-justified')) return false;
    if (typeof el.className === 'string' && SKIP.test(el.className)) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'inline' && !el.matches('.service-line > span')) return false;
    if (cs.textAlign === 'center' || cs.textAlign === 'right') return false;
    if (el.querySelector('br, img, svg')) return false;
    var text = (el.textContent || '').trim();
    if (text.length < 90) return false;
    if (contentWidth(el) < 240) return false;
    return true;
  }

  function textIndex(root) {
    var nodes = [], starts = [], acc = 0;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      nodes.push(n);
      starts.push(acc);
      acc += n.nodeValue.length;
    }
    return { nodes: nodes, starts: starts };
  }

  function locate(index, offset) {
    var nodes = index.nodes, starts = index.starts;
    var lo = 0, hi = nodes.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
    }
    var node = nodes[lo];
    var local = offset - starts[lo];
    if (local > node.nodeValue.length) local = node.nodeValue.length;
    return [node, local];
  }

  // Words are maximal runs of non-ASCII-whitespace; NBSP stays inside a word.
  function wordRanges(text) {
    var out = [], re = /[^ \t\n\r\f\v]+/g, m;
    while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
    return out;
  }

  function justify(el) {
    var width = contentWidth(el);
    if (width < 240) return;

    var original = el.innerHTML;
    var cs = getComputedStyle(el);
    var src = el.cloneNode(true);
    var text = src.textContent;

    var ranges = wordRanges(text);
    if (ranges.length < 3) return;

    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    function measure(s) { return ctx.measureText(s).width; }

    var prepared, layout;
    try {
      prepared = J.prepare(text, measure);
      if (prepared.words.length !== ranges.length) return;
      layout = J.solve(prepared, width, { mode: 'balanced' });
    } catch (err) { console.warn('Justice:', err); return; }
    if (!layout || !layout.lines || layout.lines.length < 2) return;

    var index = textIndex(src);
    var frag = document.createDocumentFragment();
    var lineEls = [];

    for (var i = 0; i < layout.lines.length; i++) {
      var line = layout.lines[i];
      var s = ranges[line.start][0];
      var e = ranges[line.end - 1][1];
      var range = document.createRange();
      var a = locate(index, s), b = locate(index, e);
      range.setStart(a[0], a[1]);
      range.setEnd(b[0], b[1]);

      var outer = document.createElement('just-line');
      if (line.opening) outer.style.marginLeft = (-line.opening) + 'px';

      var inner = document.createElement('just-inner');
      inner.appendChild(range.cloneContents());

      outer.appendChild(inner);
      frag.appendChild(outer);
      lineEls.push({ inner: inner, line: line });
    }

    el.replaceChildren(frag);
    el.setAttribute('data-justified', '');

    // Fit each line to the column using real DOM metrics (guards against
    // canvas-vs-DOM measurement drift). The last line stays ragged.
    for (var k = 0; k < lineEls.length; k++) {
      var it = lineEls[k], ln = it.line;
      if (ln.tracking) it.inner.style.letterSpacing = ln.tracking + 'px';
      var gaps = ln.end - ln.start - 1;
      if (ln.last || gaps <= 0) continue;
      var natural = it.inner.getBoundingClientRect().width;
      var extra = ln.width - natural;
      if (extra < 0 && extra > -2) extra = 0;
      var ws = extra / gaps;
      if (ws > 60) ws = 60;
      if (ws < -3) ws = -3;
      it.inner.style.wordSpacing = ws + 'px';
    }

    registry.push({ el: el, html: original });
  }

  function run() {
    var els = document.querySelectorAll(TARGETS);
    for (var i = 0; i < els.length; i++) {
      if (eligible(els[i])) justify(els[i]);
    }
  }

  function reset() {
    for (var i = 0; i < registry.length; i++) {
      var item = registry[i];
      item.el.innerHTML = item.html;
      item.el.removeAttribute('data-justified');
      item.el.style.wordSpacing = '';
      item.el.style.letterSpacing = '';
      item.el.style.textAlign = '';
    }
    registry = [];
  }

  function onResize() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () { scheduled = false; reset(); run(); }, 200);
  }

  function boot() {
    run();
    window.addEventListener('resize', onResize);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
  } else if (document.readyState === 'complete') {
    boot();
  } else {
    window.addEventListener('load', boot);
  }
})();
