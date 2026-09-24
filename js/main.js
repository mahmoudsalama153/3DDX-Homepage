document.documentElement.classList.add('js');

(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopStory = window.matchMedia('(min-width: 1101px)');
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  // Keep the poster visible instead of autoplaying for visitors who reduce motion.
  const heroVideo = document.querySelector('.hero-video');
  const updateHeroVideo = () => {
    if (!heroVideo) return;
    if (reducedMotion.matches) {
      heroVideo.pause();
      heroVideo.hidden = true;
      return;
    }
    heroVideo.hidden = false;
    heroVideo.play().catch(() => {});
  };
  reducedMotion.addEventListener('change', updateHeroVideo);
  updateHeroVideo();

  // Mobile navigation
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('#mobile-menu');
  const closeMobileMenu = () => {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileMenu.hidden = true;
    document.body.classList.remove('menu-open');
  };

  menuToggle?.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
    document.body.classList.toggle('menu-open', !open);
  });

  mobileMenu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));

  // Split section titles into words while preserving whitespace and explicit breaks.
  document.querySelectorAll('[data-scroll-heading]').forEach((heading) => {
    let wordIndex = 0;
    [...heading.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const word = document.createElement('span');
        word.className = 'heading-word';
        word.style.setProperty('--word-delay', `${wordIndex * 90}ms`);
        word.textContent = part;
        fragment.append(word);
        wordIndex += 1;
      });
      node.replaceWith(fragment);
    });
  });

  // Scroll-linked word focus, fade-up animations, and sequential card reveals
  const setupFadeUpElements = () => {
    document.querySelectorAll('[data-fade-delay]').forEach((el) => {
      const delay = el.dataset.fadeDelay;
      if (delay) el.style.setProperty('--fade-delay', /^\d+$/.test(delay) ? `${delay}ms` : delay);
    });

    document.querySelectorAll('[data-fade-stagger], .fade-stagger').forEach((container) => {
      const step = Number(container.dataset.staggerStep) || 120;
      [...container.children].forEach((item, idx) => {
        item.style.setProperty('--delay', `${idx * step}ms`);
        item.style.setProperty('--fade-delay', `${idx * step}ms`);
      });
    });
  };

  setupFadeUpElements();

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (entry.target.matches('[data-scroll-heading]')) {
        entry.target.classList.add('is-sharp');
      }
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  const revealSelector = '[data-scroll-heading], [data-stagger-list], [data-fade-up], .fade-up, [data-fade-stagger], .fade-stagger';
  document.querySelectorAll(revealSelector).forEach((element) => revealObserver.observe(element));
  document.querySelectorAll('[data-stagger-list] > *').forEach((item, index) => item.style.setProperty('--delay', `${index * 220}ms`));


  // Count key milestones once the About statistics enter the viewport.
  const countUp = (element) => {
    const target = Number(element.dataset.countUp);
    if (!Number.isFinite(target) || element.dataset.counted === 'true') return;
    element.dataset.counted = 'true';
    if (reducedMotion.matches) {
      element.textContent = String(target);
      return;
    }

    const duration = 1500;
    const start = performance.now();
    element.textContent = '0';
    const render = (now) => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(render);
    };
    window.requestAnimationFrame(render);
  };

  const counterGroups = [...document.querySelectorAll('.stat')];
  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('[data-count-up]').forEach(countUp);
        counterObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .2 });
    counterGroups.forEach((group) => counterObserver.observe(group));
  } else {
    counterGroups.forEach((group) => group.querySelectorAll('[data-count-up]').forEach(countUp));
  }

  // Desktop vertical-to-horizontal solution story. Vertical scrolling is never cancelled.
  const story = document.querySelector('[data-horizontal-story]');
  const storyTrack = story?.querySelector('[data-horizontal-track]');
  const storyViewport = story?.querySelector('.solution-viewport');
  const storyProgress = story?.querySelector('[data-horizontal-progress]');
  let storyTicking = false;

  const renderHorizontalStory = () => {
    storyTicking = false;
    if (!story || !storyTrack || !storyViewport) return;

    if (!desktopStory.matches || reducedMotion.matches) {
      storyTrack.style.transform = '';
      if (storyProgress) storyProgress.style.width = '';
      return;
    }

    const rect = story.getBoundingClientRect();
    const progressRect = storyProgress?.getBoundingClientRect();
    const progressBarVisible = !progressRect
      || (progressRect.top < window.innerHeight && progressRect.bottom > 0);
    const distance = Math.max(1, story.offsetHeight - window.innerHeight);
    const progress = progressBarVisible ? clamp(-rect.top / distance, 0, 1) : 0;
    const maxTranslate = Math.max(0, storyTrack.scrollWidth - storyViewport.clientWidth + 24);
    storyTrack.style.transform = `translate3d(${-maxTranslate * progress}px, 0, 0)`;
    if (storyProgress) storyProgress.style.width = `${progress * 100}%`;
  };

  const requestStoryRender = () => {
    if (storyTicking) return;
    storyTicking = true;
    window.requestAnimationFrame(renderHorizontalStory);
  };

  window.addEventListener('scroll', requestStoryRender, { passive: true });
  window.addEventListener('resize', requestStoryRender);
  desktopStory.addEventListener('change', requestStoryRender);
  reducedMotion.addEventListener('change', requestStoryRender);
  requestStoryRender();

  // Let the full Resources section scroll into view before it becomes the
  // stationary layer underneath the incoming Technology panel.
  const resourcesSection = document.querySelector('#resources');
  const updateResourcesStickyTop = () => {
    if (!resourcesSection) return;
    if (!desktopStory.matches || reducedMotion.matches) {
      resourcesSection.style.removeProperty('--resources-sticky-top');
      return;
    }
    const stickyTop = Math.min(0, window.innerHeight - resourcesSection.offsetHeight);
    resourcesSection.style.setProperty('--resources-sticky-top', `${stickyTop}px`);
  };

  if (resourcesSection) {
    new ResizeObserver(updateResourcesStickyTop).observe(resourcesSection);
    window.addEventListener('resize', updateResourcesStickyTop);
    desktopStory.addEventListener('change', updateResourcesStickyTop);
    reducedMotion.addEventListener('change', updateResourcesStickyTop);
    updateResourcesStickyTop();
  }

  // Reusable carousel controller
  class Carousel {
    constructor(root) {
      this.root = root;
      this.track = root.querySelector('[data-carousel-track]');
      this.window = root.querySelector('.carousel-window');
      this.prev = root.querySelector('[data-carousel-prev]');
      this.next = root.querySelector('[data-carousel-next]');
      this.dots = root.querySelector('[data-carousel-dots]');
      this.loop = root.dataset.loop === 'true';
      this.index = 0;
      this.dragStart = null;
      this.resizeObserver = new ResizeObserver(() => this.refresh(false));

      this.prev?.addEventListener('click', () => this.go(this.index - 1));
      this.next?.addEventListener('click', () => this.go(this.index + 1));
      root.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') this.go(this.index - 1);
        if (event.key === 'ArrowRight') this.go(this.index + 1);
      });
      this.window?.addEventListener('pointerdown', (event) => { this.dragStart = event.clientX; });
      this.window?.addEventListener('pointerup', (event) => {
        if (this.dragStart === null) return;
        const delta = event.clientX - this.dragStart;
        this.dragStart = null;
        if (Math.abs(delta) > 45) this.go(this.index + (delta < 0 ? 1 : -1));
      });
      this.window?.addEventListener('pointercancel', () => { this.dragStart = null; });
      this.root.addEventListener('carousel:refresh', () => this.refresh(true));
      this.resizeObserver.observe(root);
      this.refresh(true);
    }

    get slides() {
      return [...this.root.querySelectorAll('[data-carousel-slide]')].filter((slide) => !slide.hidden);
    }

    get maxIndex() {
      const slides = this.slides;
      if (!slides.length || !this.window) return 0;
      if (this.root.classList.contains('testimonial-carousel')) return slides.length - 1;
      const firstWidth = slides[0].getBoundingClientRect().width || 1;
      const visible = Math.max(1, Math.floor((this.window.clientWidth + 1) / firstWidth));
      return Math.max(0, slides.length - visible);
    }

    refresh(rebuildDots = false) {
      if (rebuildDots) this.buildDots();
      this.index = clamp(this.index, 0, this.maxIndex);
      this.render();
    }

    buildDots() {
      if (!this.dots) return;
      this.dots.replaceChildren();
      const count = this.maxIndex + 1;
      for (let index = 0; index < count; index += 1) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Go to item ${index + 1}`);
        dot.addEventListener('click', () => this.go(index));
        this.dots.append(dot);
      }
    }

    go(nextIndex) {
      const max = this.maxIndex;
      if (this.loop) {
        this.index = nextIndex < 0 ? max : nextIndex > max ? 0 : nextIndex;
      } else {
        this.index = clamp(nextIndex, 0, max);
      }
      this.render();
    }

    render() {
      const slides = this.slides;
      if (!this.track || !slides.length) return;
      const target = slides[this.index] || slides[0];
      this.track.style.transform = `translate3d(${-target.offsetLeft}px, 0, 0)`;
      this.prev?.toggleAttribute('disabled', !this.loop && this.index === 0);
      this.next?.toggleAttribute('disabled', !this.loop && this.index === this.maxIndex);
      [...(this.dots?.children || [])].forEach((dot, index) => dot.setAttribute('aria-current', String(index === this.index)));
      slides.forEach((slide, index) => slide.setAttribute('aria-hidden', String(index < this.index || index > this.index + 2)));
    }
  }

  const carousels = [...document.querySelectorAll('[data-carousel]')].map((element) => new Carousel(element));

  // Resource tabs update the existing carousel rather than rebuilding content.
  document.querySelectorAll('[data-tabs]').forEach((tabsRoot) => {
    const tabs = [...tabsRoot.querySelectorAll('[data-tab]')];
    const resourceCarousel = tabsRoot.querySelector('[data-carousel]');
    const selectTab = (selected) => {
      const category = selected.dataset.tab;
      tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab === selected)));
      tabsRoot.querySelectorAll('[data-category]').forEach((card) => {
        card.hidden = category !== 'all' && card.dataset.category !== category;
      });
      resourceCarousel?.dispatchEvent(new CustomEvent('carousel:refresh'));
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        tabs[next].focus();
        selectTab(tabs[next]);
      });
    });
  });

  // Independently controlled accordions
  document.querySelectorAll('[data-accordion] button[aria-controls]').forEach((button) => {
    const initialAnswer = document.getElementById(button.getAttribute('aria-controls'));
    initialAnswer?.removeAttribute('hidden');
    initialAnswer?.setAttribute('aria-hidden', String(button.getAttribute('aria-expanded') !== 'true'));

    button.addEventListener('click', () => {
      const item = button.closest('.accordion-item');
      const answer = document.getElementById(button.getAttribute('aria-controls'));
      const open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!open));
      answer?.setAttribute('aria-hidden', String(open));
      item?.classList.toggle('is-open', !open);
    });
  });

  // Floating contact menu becomes available from About onward.
  const contactMenu = document.querySelector('[data-contact-menu]');
  const contactToggle = contactMenu?.querySelector('.contact-toggle');
  const aboutSection = document.querySelector('#about');
  let contactTicking = false;

  const closeContactMenu = () => {
    contactMenu?.classList.remove('is-open');
    contactToggle?.setAttribute('aria-expanded', 'false');
    contactToggle?.setAttribute('aria-label', 'Open contact menu');
  };

  const updateContactVisibility = () => {
    contactTicking = false;
    if (!contactMenu || !aboutSection) return;
    const aboutTop = aboutSection.getBoundingClientRect().top + window.scrollY;
    const visible = window.scrollY >= aboutTop - 4;
    contactMenu.hidden = !visible;
    contactMenu.classList.toggle('is-visible', visible);
    if (!visible) closeContactMenu();
  };

  window.addEventListener('scroll', () => {
    if (contactTicking) return;
    contactTicking = true;
    window.requestAnimationFrame(updateContactVisibility);
  }, { passive: true });

  contactToggle?.addEventListener('click', () => {
    const open = contactMenu.classList.toggle('is-open');
    contactToggle.setAttribute('aria-expanded', String(open));
    contactToggle.setAttribute('aria-label', open ? 'Close contact menu' : 'Open contact menu');
  });

  document.addEventListener('click', (event) => {
    if (contactMenu?.classList.contains('is-open') && !contactMenu.contains(event.target)) closeContactMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeContactMenu();
      closeMobileMenu();
    }
  });

  updateContactVisibility();

  // Static newsletter: validate locally and deliberately avoid transmission.
  document.querySelector('[data-newsletter]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.querySelector('input[type="email"]');
    const status = form.querySelector('.form-status');
    if (!input.checkValidity()) {
      status.textContent = 'Please enter a valid email address.';
      input.focus();
      return;
    }
    status.textContent = 'Subscription will be connected in WordPress.';
  });

  // Recompute controls after fonts and imagery settle.
  window.addEventListener('load', () => {
    carousels.forEach((carousel) => carousel.refresh(true));
    requestStoryRender();
  });
})();
