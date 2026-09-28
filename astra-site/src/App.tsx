import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

const StructuralModel = lazy(() => import('./StructuralModel'));

type Lang = 'en' | 'ko';

type Project = {
  image: string;
  label: Record<Lang, string>;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  number: string;
};

const projects: Project[] = [
  {
    image: '/images/project-desert.webp',
    number: '01',
    label: { en: 'CULTURE / PUBLIC REALM', ko: '문화 / 공공 공간' },
    title: { en: 'Solstice Forum', ko: '솔스티스 포럼' },
    summary: {
      en: 'An imagined civic landmark shaped by light, landscape, and a generous public ground.',
      ko: '빛과 지형, 모두에게 열린 광장을 중심으로 상상한 공공 건축 프로젝트입니다.',
    },
  },
  {
    image: '/images/project-waterfront.webp',
    number: '02',
    label: { en: 'INFRASTRUCTURE / CONNECTION', ko: '인프라 / 연결' },
    title: { en: 'Bluewater Passage', ko: '블루워터 패시지' },
    summary: {
      en: 'A conceptual waterfront crossing where everyday movement becomes a shared experience.',
      ko: '일상의 이동이 하나의 공간 경험이 되는 해안 연결 시설의 콘셉트입니다.',
    },
  },
  {
    image: '/images/project-facade.webp',
    number: '03',
    label: { en: 'ARCHITECTURE / MATERIAL', ko: '건축 / 재료' },
    title: { en: 'Strata House', ko: '스트라타 하우스' },
    summary: {
      en: 'A study in material rhythm, precise structure, and the changing character of daylight.',
      ko: '재료의 리듬과 정교한 구조, 하루 동안 달라지는 빛을 탐구한 건축 콘셉트입니다.',
    },
  },
];

const content = {
  en: {
    navWork: 'Selected work',
    navProcess: 'Our approach',
    navExpertise: 'Expertise',
    navContact: 'Start a conversation',
    menu: 'Menu',
    close: 'Close',
    pageTitle: 'Technology Expert Lab — Building tomorrow with insight',
    heroDisciplines: 'ARCHITECTURE · ENGINEERING · CONSTRUCTION TECHNOLOGY',
    heroTopline: 'TECHNOLOGY EXPERT LAB / 2026',
    mobileTagline: 'Technology Expert Lab / BUILT ENVIRONMENTS',
    heroEyebrow: 'TECHNOLOGY EXPERT LAB / BUILT ENVIRONMENTS',
    heroTitle1: 'Technology builds',
    heroTitle2: 'what comes next.',
    heroBody: 'From the first line of design to the finished place. Technology Expert Lab explores what better building can become.',
    explore: 'DISCOVER MORE',
    introEyebrow: '01 / OUR PERSPECTIVE',
    introA: 'The bigger picture.',
    introB: 'In every detail.',
    introBody: 'A line of design, the grain of a material, the way light enters a room. Technology Expert Lab brings engineering and human experience into every choice.',
    introFoot: 'Where material meets light.',
    workEyebrow: '02 / SELECTED VISIONS',
    workTitleA: 'Perspectives',
    workTitleB: 'made tangible.',
    workBody: 'From connections across water to places worth staying. A collection of architectural possibilities.',
    viewProject: 'Explore concept',
    modalKicker: 'CONCEPT STUDY',
    modelEyebrow: 'THE MAKING / TEL HOUSE',
    modelNote: 'A STUDY IN STRUCTURE, MATERIAL & LIGHT',
    modelStories: [
      { label: 'FOUNDATION & FRAME', titleA: 'Set the ground.', titleB: 'Find the order.', body: 'The foundation meets the core. Column by column, beam by beam, the house finds its structure.' },
      { label: 'GLASS & STRUCTURE', titleA: 'A structure', titleB: 'opens to light.', body: 'Glass and fine frames connect interior life to the world outside. A precise slab gives the upper level its footing.' },
      { label: 'CEDAR & ROOF', titleA: 'Materials give', titleB: 'a place its character.', body: 'Cedar cladding, a long window, and a quiet roof bring warmth and proportion to the house.' },
      { label: 'DECK & WATER', titleA: 'A building becomes', titleB: 'a place to live.', body: 'The deck, water, and the small details of daily life complete the architecture.' },
    ],
    expertiseEyebrow: '03 / WHERE WE WORK',
    expertiseTitle: 'Every scale of everyday life.',
    expertiseBody: 'The same attention should carry from a single threshold to the systems that connect entire communities.',
    services: [
      { no: '01', name: 'Architecture & places', detail: 'Spaces that invite people in and make them want to stay.', more: 'We think about how a building meets the street, holds light, and changes with the people who use it.' },
      { no: '02', name: 'Infrastructure & mobility', detail: 'Connections that make daily life flow more naturally.', more: 'The most important connections are felt in ordinary moments: a safer crossing, a shorter journey, a more open waterfront.' },
      { no: '03', name: 'Construction innovation', detail: 'Digital thinking and physical craft working as one.', more: 'We use visual models to test ideas early and make complex spatial decisions easier to understand.' },
    ],
    contactEyebrow: 'THE NEXT CHAPTER STARTS HERE',
    contactTitleA: 'The next place.',
    contactTitleB: 'Let’s build it.',
    contactBody: 'Your idea could be the beginning of our next story.',
    contactButton: 'Start a conversation',
    formTitle: 'Tell us what you imagine.',
    formName: 'Your name',
    formEmail: 'Email address',
    formIdea: 'What would you like to build?',
    formSend: 'Preview inquiry',
    formNotice: 'This is a concept website. This form previews an inquiry and does not send data.',
    formDone: 'Inquiry preview complete. No message was sent.',
    footerTop: 'BACK TO TOP',
    footerNote: 'The projects and images on this site are fictional concepts created for this experience.',
    footerCredit: '© 2026 Technology Expert Lab / CONCEPT EXPERIENCE',
    footerExplore: 'THE NEXT POSSIBILITY OF PLACE',
    contactLabel: 'TECHNOLOGY EXPERT LAB / CONTACT',
  },
  ko: {
    navWork: '프로젝트',
    navProcess: '짓는 방식',
    navExpertise: '사업 영역',
    navContact: '문의하기',
    menu: '메뉴',
    close: '닫기',
    pageTitle: 'Technology Expert Lab — 기술로 짓는 공간의 내일',
    heroDisciplines: '건축 · 엔지니어링 · 건설 기술',
    heroTopline: 'TECHNOLOGY EXPERT LAB / 2026',
    mobileTagline: 'Technology Expert Lab / 기술로 짓는 공간',
    heroEyebrow: 'TECHNOLOGY EXPERT LAB / 건축 기술 연구',
    heroTitle1: '기술이 짓는',
    heroTitle2: '공간의 내일.',
    heroBody: '설계의 선에서 완성의 순간까지.\nTechnology Expert Lab이 공간의 가능성을 탐구합니다.',
    explore: '더 알아보기',
    introEyebrow: '01 / 기술과 공간을 바라보는 시선',
    introA: '큰 변화는',
    introB: '작은 디테일에서.',
    introBody: '설계의 한 선과 재료의 결, 빛이 닿는 방식까지. Technology Expert Lab은 기술로 세부를 검증하고 사람의 일상에 맞는 공간을 연구합니다.',
    introFoot: '재료와 빛이 만나는 순간',
    workEyebrow: '02 / 상상한 프로젝트',
    workTitleA: '우리가 그리는',
    workTitleB: '다음 풍경.',
    workBody: '도시를 잇는 다리부터 오래 머무는 건축까지. 공간의 가능성을 탐구합니다.',
    viewProject: '콘셉트 살펴보기',
    modalKicker: '가상 콘셉트 프로젝트',
    modelEyebrow: '공간의 탄생 / TEL HOUSE',
    modelNote: '구조와 재료, 빛에 관한 연구',
    modelStories: [
      { label: '기초와 골조', titleA: '터를 놓고', titleB: '기준을 세웁니다.', body: '기초 위에 기둥이 서고, 보가 그 사이를 잇습니다. 하나의 부재에서 공간의 질서가 시작됩니다.' },
      { label: '유리와 구조', titleA: '구조 사이로', titleB: '빛이 들어옵니다.', body: '유리와 가느다란 프레임이 안과 밖을 잇습니다. 정교한 슬래브가 위층의 바탕이 됩니다.' },
      { label: '목재와 지붕', titleA: '나무가', titleB: '표정을 만듭니다.', body: '목재 외피와 긴 창, 낮고 넓은 지붕이 한 채의 집에 온기와 비례를 더합니다.' },
      { label: '데크와 물', titleA: '마침내', titleB: '살아갈 장소로.', body: '데크와 물, 일상의 작은 물건이 더해지면 구조는 사람의 삶을 담는 공간이 됩니다.' },
    ],
    expertiseEyebrow: '03 / 사업 영역',
    expertiseTitle: '일상의 모든\n규모를 짓다.',
    expertiseBody: '건물의 작은 문턱부터 지역을 잇는 인프라까지, 같은 세심함으로 접근합니다.',
    services: [
      { no: '01', name: '건축과 공간', detail: '사람이 들어오고 오래 머물고 싶은 장소를 만듭니다.', more: '건물이 거리와 만나는 방식, 빛을 품는 방식, 사용하는 사람과 함께 변화하는 방식을 생각합니다.' },
      { no: '02', name: '인프라와 이동', detail: '일상의 흐름을 더 자연스럽게 잇습니다.', more: '더 안전한 횡단, 더 짧은 이동, 더 열린 수변처럼 중요한 연결은 평범한 순간에 드러납니다.' },
      { no: '03', name: '건설 기술', detail: '디지털 사고와 실제 시공 기술을 연결합니다.', more: '시각 모델로 구상을 일찍 검증하고 복잡한 공간의 결정을 더 쉽게 이해하도록 돕습니다.' },
    ],
    contactEyebrow: '다음 이야기는 여기서 시작됩니다',
    contactTitleA: '다음 공간을',
    contactTitleB: '함께 짓습니다.',
    contactBody: '당신의 구상에서 우리의 다음 이야기가 시작됩니다.',
    contactButton: '문의 작성해 보기',
    formTitle: '구상한 공간을 들려주세요.',
    formName: '이름',
    formEmail: '이메일',
    formIdea: '어떤 공간을 만들고 싶으신가요?',
    formSend: '문의 미리보기',
    formNotice: '이 사이트는 콘셉트 데모입니다. 입력한 내용은 전송되지 않습니다.',
    formDone: '문의 화면을 확인했습니다. 메시지는 전송되지 않았습니다.',
    footerTop: '맨 위로',
    footerNote: '이 웹사이트의 프로젝트와 이미지는 시연을 위해 만든 가상 콘셉트입니다.',
    footerCredit: '© 2026 Technology Expert Lab / 콘셉트 웹사이트',
    footerExplore: '공간의 다음 가능성',
    contactLabel: 'TECHNOLOGY EXPERT LAB / 문의',
  },
} as const;

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal ? (
    <svg width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden="true">
      <path d="M3 16L16 3M6.5 3H16V12.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ) : (
    <svg width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden="true">
      <path d="M2 9.5H16M10 3.5L16 9.5L10 15.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className={`wordmark${light ? ' wordmark--light' : ''}`}>
      <svg className="wordmark__symbol" viewBox="0 0 42 42" fill="none" aria-hidden="true">
        <path d="M4 7H38M21 7V35M4 35H38M21 21H36" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      <span className="wordmark__initials">TEL</span>
      <span className="wordmark__full">Technology Expert Lab</span>
    </span>
  );
}

function useReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function StructuralExperience({ lang }: { lang: Lang }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [loadModel, setLoadModel] = useState(false);
  const t = content[lang];
  const stage = Math.min(3, Math.floor(progress * 4));
  const story = t.modelStories[stage];
  const goToChapter = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const positions = [0.04, 0.34, 0.64, 0.98];
    const top = section.offsetTop + (section.offsetHeight - window.innerHeight) * positions[index];
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const section = sectionRef.current;
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const length = Math.max(1, rect.height - window.innerHeight);
        setProgress(Math.min(1, Math.max(0, -rect.top / length)));
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setLoadModel(true);
        observer.disconnect();
      }
    }, { rootMargin: '650px 0px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="approach" className="structure-section" ref={sectionRef} aria-label={t.modelEyebrow}>
      <div className="structure-sticky" data-stage={stage}>
        <div className="structure-copy">
          <span className="section-label section-label--light">{t.modelEyebrow}</span>
          <div className="structure-copy__story" key={`${lang}-${stage}`}>
            <h2>{story.titleA}<br /><em>{story.titleB}</em></h2>
            <p>{story.body}</p>
          </div>
        </div>
        <div className="structure-identity"><span>TEL HOUSE</span><small>{t.modelNote}</small></div>
        <Suspense fallback={<div className="structure-visual"><div className="structure-visual__fallback" /></div>}>
          {loadModel && <StructuralModel progress={progress} lang={lang} />}
        </Suspense>
        <nav className="structure-chapters" aria-label={lang === 'ko' ? '건축의 네 장면' : 'Four chapters of construction'}>
          {t.modelStories.map((item, index) => (
            <button key={item.label} type="button" className={stage === index ? 'is-active' : ''} aria-current={stage === index ? 'step' : undefined} onClick={() => goToChapter(index)}>
              <span className="chapter-number">0{index + 1}</span><span>{item.label}</span>
              <i aria-hidden="true"><b style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress * 4 - index))})` }} /></i>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>('ko');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const projectDialogRef = useRef<HTMLDialogElement>(null);
  const contactDialogRef = useRef<HTMLDialogElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const t = content[lang];

  useReveal();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = content[lang].pageTitle;
  }, [lang]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > 28);
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        document.documentElement.style.setProperty('--page-progress', String(window.scrollY / max));
        if (heroRef.current) heroRef.current.style.setProperty('--hero-drift', `${Math.min(window.scrollY * 0.22, 180)}px`);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const dialog = projectDialogRef.current;
    if (!dialog) return;
    if (selectedProject !== null && !dialog.open) dialog.showModal();
    if (selectedProject === null && dialog.open) dialog.close();
  }, [selectedProject]);

  useEffect(() => {
    const dialog = contactDialogRef.current;
    if (!dialog) return;
    if (contactOpen && !dialog.open) dialog.showModal();
    if (!contactOpen && dialog.open) dialog.close();
  }, [contactOpen]);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const openContact = () => {
    closeMenu();
    setContactDone(false);
    setContactOpen(true);
  };
  const submitContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactDone(true);
  };

  return (
    <>
      <div className="page-rail" aria-hidden="true"><span /></div>
      <header className={`site-header${scrolled || menuOpen ? ' site-header--solid' : ''}`}>
        <a className="site-header__brand" href="#top" aria-label={lang === 'ko' ? 'Technology Expert Lab 첫 화면' : 'Technology Expert Lab home'} onClick={closeMenu}><Wordmark light /></a>
        <nav className="site-header__nav" aria-label={lang === 'ko' ? '주 메뉴' : 'Main navigation'}>
          <a href="#work">{t.navWork}</a>
          <a href="#approach">{t.navProcess}</a>
          <a href="#expertise">{t.navExpertise}</a>
        </nav>
        <div className="site-header__actions">
          <button className="language-button" type="button" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')} aria-label={lang === 'en' ? 'Switch to Korean' : '영어로 전환'}>{lang === 'en' ? 'KR' : 'EN'}</button>
          <button className="header-contact" type="button" onClick={openContact}>{t.navContact}<ArrowIcon diagonal /></button>
          <button className={`menu-toggle${menuOpen ? ' menu-toggle--open' : ''}`} type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? t.close : t.menu}><span /><span /></button>
        </div>
      </header>

      <div id="mobile-menu" className={`mobile-menu${menuOpen ? ' mobile-menu--open' : ''}`} aria-hidden={!menuOpen}>
        <nav aria-label={lang === 'ko' ? '모바일 메뉴' : 'Mobile navigation'}>
          <a href="#work" onClick={closeMenu}><span>01</span>{t.navWork}<ArrowIcon diagonal /></a>
          <a href="#approach" onClick={closeMenu}><span>02</span>{t.navProcess}<ArrowIcon diagonal /></a>
          <a href="#expertise" onClick={closeMenu}><span>03</span>{t.navExpertise}<ArrowIcon diagonal /></a>
          <button type="button" onClick={openContact}><span>04</span>{t.navContact}<ArrowIcon diagonal /></button>
        </nav>
        <p>{t.mobileTagline}</p>
      </div>

      <main>
        <section id="top" className="hero" ref={heroRef}>
          <div className="hero__image" />
          <div className="hero__veil" />
          <div className="hero__topline"><span>{t.heroEyebrow}</span><span>{t.heroTopline}</span></div>
          <div className="hero__content">
            <span className="hero__side">{t.heroDisciplines}</span>
            <h1><span>{t.heroTitle1}</span><span>{t.heroTitle2}</span></h1>
            <p className="hero__description">{t.heroBody}</p>
          </div>
          <div className="hero__bottom"><a href="#introduction" className="hero__explore"><span>{t.explore}</span><span className="hero__explore-icon">↓</span></a><span className="hero__caption">{lang === 'ko' ? '새로운 풍경의 시작' : 'A new perspective on possibility'}</span></div>
        </section>

        <section id="introduction" className="introduction section-pad">
          <div className="intro-grid">
            <div className="intro-copy" data-reveal>
              <span className="section-label">{t.introEyebrow}</span>
              <h2>{t.introA}<br /><em>{t.introB}</em></h2>
              <p>{t.introBody}</p>
              <a href="#approach" className="text-link">{t.navProcess}<ArrowIcon diagonal /></a>
            </div>
            <figure className="intro-image" data-reveal>
              <div><img src="/images/material-detail.webp" alt={lang === 'ko' ? '석재와 브론즈, 유리의 정교한 접합부' : 'A precise junction of stone, bronze and glass'} loading="lazy" /></div>
              <figcaption><span>{lang === 'ko' ? '01 — 재료' : '01 — MATERIAL'}</span><span>{t.introFoot}</span></figcaption>
            </figure>
          </div>
        </section>

        <StructuralExperience lang={lang} />

        <section id="work" className="work-section section-pad">
          <div className="work-heading" data-reveal>
            <span className="section-label">{t.workEyebrow}</span>
            <div className="work-heading__body"><h2>{t.workTitleA}<br /><em>{t.workTitleB}</em></h2><p>{t.workBody}</p></div>
          </div>
          <div className="projects-grid">
            {projects.map((project, index) => (
              <button className={`project-card project-card--${index + 1}`} key={project.number} type="button" onClick={() => setSelectedProject(index)} data-reveal>
                <span className="project-card__frame"><img src={project.image} alt="" loading="lazy" /><span className="project-card__view"><ArrowIcon diagonal /></span></span>
                <span className="project-card__caption"><span><small>{project.label[lang]}</small><strong>{project.title[lang]}</strong></span><span className="project-card__index">{project.number}<ArrowIcon diagonal /></span></span>
              </button>
            ))}
          </div>
        </section>

        <section id="expertise" className="expertise-section section-pad">
          <div className="expertise-heading" data-reveal><span className="section-label">{t.expertiseEyebrow}</span><h2>{t.expertiseTitle}</h2><p>{t.expertiseBody}</p></div>
          <div className="service-list">
            {t.services.map((service) => (
              <details className="service-item" key={service.no} data-reveal>
                <summary className="service-row"><span className="service-row__no">{service.no}</span><span className="service-row__title">{service.name}</span><span className="service-row__detail">{service.detail}</span><ArrowIcon diagonal /></summary>
                <p className="service-item__more">{service.more}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="contact-section">
          <div className="contact-section__content" data-reveal>
            <span className="section-label section-label--light">{t.contactEyebrow}</span>
            <div className="contact-section__heading"><h2>{t.contactTitleA}<br /><em>{t.contactTitleB}</em></h2><button className="round-cta" type="button" onClick={openContact} aria-label={t.contactButton}><ArrowIcon diagonal /></button></div>
            <div className="contact-section__bottom"><p>{t.contactBody}</p><button className="text-link text-link--light" type="button" onClick={openContact}>{t.navContact}<ArrowIcon diagonal /></button></div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__main"><span>{t.footerExplore}</span><a href="#top">{t.footerTop} ↑</a></div>
        <div className="footer-wordmark" aria-hidden="true">Technology<br />Expert Lab</div>
        <div className="site-footer__bottom"><span>{t.footerCredit}</span><p>{t.footerNote}</p><span>{t.footerExplore}</span></div>
      </footer>

      <dialog className="project-dialog" ref={projectDialogRef} onClose={() => setSelectedProject(null)} aria-label={selectedProject !== null ? projects[selectedProject].title[lang] : lang === 'ko' ? '프로젝트' : 'Project'}>
        {selectedProject !== null && (
          <div className="project-dialog__inner">
            <div className="project-dialog__image" style={{ backgroundImage: `url(${projects[selectedProject].image})` }} />
            <div className="project-dialog__content"><button className="dialog-close" type="button" onClick={() => setSelectedProject(null)} aria-label={t.close}>×</button><span className="section-label">{t.modalKicker} / {projects[selectedProject].number}</span><h2>{projects[selectedProject].title[lang]}</h2><span className="project-dialog__label">{projects[selectedProject].label[lang]}</span><p>{projects[selectedProject].summary[lang]}</p><button className="text-link" type="button" onClick={() => setSelectedProject(null)}>{t.close}<ArrowIcon /></button></div>
          </div>
        )}
      </dialog>

      <dialog className="contact-dialog" ref={contactDialogRef} onClose={() => setContactOpen(false)} aria-label={t.formTitle}>
        <div className="contact-dialog__inner">
          <button className="dialog-close" type="button" onClick={() => setContactOpen(false)} aria-label={t.close}>×</button>
          <span className="section-label">{t.contactLabel}</span>
          <h2>{t.formTitle}</h2>
          <p className="contact-dialog__notice">{t.formNotice}</p>
          {contactDone ? <div className="contact-dialog__done" role="status">{t.formDone}</div> : (
            <form onSubmit={submitContact}>
              <label>{t.formName}<input name="name" type="text" autoComplete="name" required /></label>
              <label>{t.formEmail}<input name="email" type="email" autoComplete="email" required /></label>
              <label>{t.formIdea}<textarea name="idea" rows={3} required /></label>
              <button className="contact-dialog__submit" type="submit">{t.formSend}<ArrowIcon diagonal /></button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
