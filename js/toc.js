(() => {
  const links = [...document.querySelectorAll('.toc a')];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  if (!sections.length) return;

  const update = () => {
    let current = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= 160) current = section;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
      current = sections.at(-1);
    }
    links.forEach((link) => {
      if (current && link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
