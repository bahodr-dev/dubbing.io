import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, AudioLines, ChevronDown, FileText,
  Film, Globe2, GraduationCap, Languages, Menu,
  Mic2, MoveUpRight, SlidersHorizontal, X, RotateCcw, Captions,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { LandingNavigation } from '../components/LandingNavigation';
import { useLandingReveal } from '../hooks/useLandingReveal';
import './LandingView.css';

interface LandingViewProps {
  isAuthenticated: boolean;
}

const features = [
  { icon: Languages, title: 'Tarjima, kontekst bilan.', text: 'Original va tarjima matnlarini yonma-yon ko‘ring. Muhim atamalarni natijani yaratishdan oldin tuzating.' },
  { icon: Mic2, title: 'Har ovozning o‘z o‘rni bor.', text: 'So‘zlovchilarni alohida ajrating, ularga ovoz tanlang yoki ruxsat asosida ovoz klonlashdan foydalaning.' },
  { icon: SlidersHorizontal, title: 'Oxirgi so‘z — sizniki.', text: 'Transkript, tarjima va ovoz sozlamalari bitta studiyada. Natijani ko‘rib chiqing va o‘zingizga moslang.' },
  { icon: FileText, title: 'Video bilan birga subtitr.', text: 'Tarjima matnini SRT yoki VTT shaklida oling. Uni video muharriringizda yoki boshqa platformada ishlating.' },
];

const questions = [
  ['Dubla qanday ishlaydi?', 'Video yoki audio faylni yuklaysiz, original va tarjima tilini tanlaysiz. Dubla nutqni matnga aylantiradi, tarjima va ovoz yaratishga yordam beradi. Matnni studiyada tekshirib, tayyor natijani yuklab olasiz.'],
  ['O‘zbek tilida dublyaj qilish mumkinmi?', 'Ha. Masalan, inglizcha yoki ruscha kontentni o‘zbekchaga tarjima qilish uchun foydalanishingiz mumkin. Tarjimani studiyada tekshirish va atamalarni tuzatish imkoniyati bor.'],
  ['Original odamning ovozini ishlatsa bo‘ladimi?', 'Ovoz klonlashdan foydalanish mumkin. Buning uchun har bir so‘zlovchining ruxsati va yetarli sifatli audio namuna kerak. Natija yozuv sifati va tanlangan ovoz xizmatiga bog‘liq.'],
  ['Qancha uzunlikdagi video yuklash mumkin?', 'Hozirgi beta bosqichida standart chegara 15 daqiqa. Qisqa va aniq nutqli videodan boshlashni tavsiya qilamiz.'],
  ['Hozir foydalanishni boshlasa bo‘ladimi?', 'Dubla hozir beta bosqichida. Hisob ochish sahifasidan boshlang. Taklif kodi so‘ralsa, sizga berilgan taklif havolasidan foydalaning. Onlayn to‘lovlar hozircha ochilmagan.'],
  ['Qanday videolarni yuklash mumkin?', 'O‘zingizga tegishli yoki tarjima qilishga ruxsat berilgan kontentni yuklang. Boshqa odamning ovozini klonlash uchun uning roziligini oling.'],
];

const contentSamples = [
  {
    id: 'education', icon: GraduationCap, label: 'Ta’lim va kurslar',
    title: 'Bilim til tanlamasin.',
    description: 'Murakkab mavzuni tushunish uchun avval boshqa tilni o‘rganish shart bo‘lmasin. Dars va qo‘llanmalaringizni o‘quvchingiz tilida tayyorlang.',
    source: 'A great lesson makes a complex idea feel simple. Let’s take it one step at a time.',
    translation: 'Yaxshi dars murakkab g‘oyani sodda tushuntiradi. Keling, uni bosqichma-bosqich o‘rganamiz.',
    project: 'Birinchi dars', duration: '00:08',
  },
  {
    id: 'creators', icon: Film, label: 'Kontent yaratuvchilar',
    title: 'Hikoyangiz yangi tilga ko‘chsin.',
    description: 'Podkastdagi fikr, intervyudagi hikoya yoki videodagi g‘oya. Ularni boshqa auditoriyaga tushunarli qilib yetkazing, tarjima matnini o‘z uslubingizga moslang.',
    source: 'Behind every creative project is a story worth sharing. This is where ours begins.',
    translation: 'Har bir ijodiy loyiha ortida ulashishga arziydigan hikoya bor. Bizning hikoyamiz shu yerdan boshlanadi.',
    project: 'Yangi hikoya', duration: '00:09',
  },
  {
    id: 'business', icon: Globe2, label: 'Biznes va jamoalar',
    title: 'Muhim xabar yaqinroq eshitilsin.',
    description: 'Mahsulot taqdimoti va jamoangiz uchun treninglarni mahalliylashtiring. Brend nomi va muhim atamalarni tarjimada o‘zingiz nazorat qiling.',
    source: 'Meet your new workspace. Everything your team needs, brought together in one place.',
    translation: 'Yangi ish maydoningiz bilan tanishing. Jamoangizga kerakli vositalar — barchasi bir joyda.',
    project: 'Mahsulot taqdimoti', duration: '00:07',
  },
];

function TranslationShowcase({ destination }: { destination: string }) {
  const [selected, setSelected] = useState(0);
  const [translation, setTranslation] = useState(contentSamples[0].translation);
  const sample = contentSamples[selected];
  const selectSample = (index: number) => {
    if (index === selected) return;
    setSelected(index);
    setTranslation(contentSamples[index].translation);
  };
  return (
    <section className="landing-showcase landing-container" id="try-sample">
      <div className="landing-section-heading landing-heading-row" data-reveal>
        <div><span className="landing-kicker">TARJIMA NAMUNASI</span><h2>Tarjima tayyor bo‘lsa ham,<br /><span>oxirgi so‘z sizniki.</span></h2></div>
        <p>Kontent turini tanlang. O‘zbekcha matnni o‘zgartiring.<br />Natija qanday ko‘rinishini shu yerda ko‘ring.</p>
      </div>
      <div role="tablist" aria-label="Kontent turini tanlang" className="landing-sample-tabs">
        {contentSamples.map(({ id, icon: Icon, label }, index) => (
          <button type="button" key={id} id={`sample-tab-${id}`} role="tab" aria-selected={index === selected} aria-controls="sample-content" tabIndex={index === selected ? 0 : -1}
            onClick={() => selectSample(index)}
            onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (selected + 1) % contentSamples.length
                : event.key === 'ArrowLeft' ? (selected + contentSamples.length - 1) % contentSamples.length
                  : event.key === 'Home' ? 0 : event.key === 'End' ? contentSamples.length - 1 : null;
              if (next === null) return;
              event.preventDefault();
              selectSample(next);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
            }}><Icon size={17} />{label}</button>
        ))}
      </div>
      <div id="sample-content" role="tabpanel" aria-labelledby={`sample-tab-${sample.id}`} className="landing-sample-panel">
        <div className="landing-sample-story" data-reveal>
          <h3>{sample.title}</h3><p>{sample.description}</p>
          <Link to={destination} className="landing-text-link">O‘z videom bilan boshlash <ArrowRight size={17} /></Link>
          <span className="landing-sample-disclaimer">Matn bilan ishlash namunasi</span>
        </div>
        <div className="landing-sample-workbench" data-reveal>
          <div className="landing-sample-heading"><span><span />{sample.project}</span><small>EN → UZ</small></div>
          <div className="landing-sample-original"><span>ORIGINAL · ENGLISH</span><p lang="en">{sample.source}</p></div>
          <div className="landing-sample-edit"><div><label htmlFor="sample-translation">TARJIMA · O‘ZBEKCHA</label><button type="button" onClick={() => setTranslation(sample.translation)} aria-label="Namuna tarjimasini tiklash"><RotateCcw size={13} /> Tiklash</button></div><textarea id="sample-translation" lang="uz" value={translation} onChange={(event) => setTranslation(event.target.value)} rows={3} spellCheck={false} /><span>Matnni o‘z uslubingizga moslab ko‘ring <SlidersHorizontal size={12} /></span></div>
          <div className="landing-sample-subtitle"><div><Captions size={17} /><span>SUBTITR KO‘RINISHI</span><small>{sample.duration}</small></div><p>{translation.trim() || 'Tarjima matnini yuqoriga yozing…'}</p></div>
        </div>
      </div>
    </section>
  );
}

function StudioPreview() {
  const [language, setLanguage] = useState<'en' | 'uz'>('uz');
  const translated = language === 'uz';
  return (
    <div className="landing-preview-wrap" data-reveal>
      <div className="landing-studio-preview">
        <div className="landing-preview-chrome">
          <span><Logo size={15} /> dubla.uz / studio</span>
          <span className="landing-preview-label">Interfeys namunasi</span>
        </div>
        <div className="landing-preview-layout">
          <div className="landing-preview-editor">
            <div className="landing-preview-columns">
              <div className="landing-preview-video">
                <div className="landing-preview-cover"><div>Dunyo g‘oyalari.<br /><em>Sizning tilingizda.</em></div><span className="landing-cover-caption">{translated ? 'Har bir buyuk g‘oya suhbatdan boshlanadi.' : 'Every great idea starts with a conversation.'}</span></div>
                <div className="landing-preview-video-bottom"><span><Film size={13} /> intro-video.mp4</span><span>00:12 / 00:45</span></div>
              </div>
              <div className="landing-preview-transcript">
                <div className="landing-transcript-heading"><FileText size={14} /> Transkript <span>EN → UZ</span></div>
                <div className="landing-transcript-line"><span>00:00 — 00:05</span><small>Every great idea starts with a conversation.</small><p>Har bir buyuk g‘oya suhbatdan boshlanadi.</p></div>
                <div className="landing-transcript-line is-selected"><span>00:05 — 00:12</span><small>Let’s make it understandable to everyone.</small><p>Keling, uni barchaga tushunarli qilamiz.</p></div>
                <div className="landing-preview-voice"><Mic2 size={14} /><span>Ovoz <strong>Farrux · O‘zbekcha</strong></span></div>
              </div>
            </div>
            <div className="landing-preview-timeline">
              <div className="landing-timeline-ruler"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span><span>00:40</span></div>
              <div className="landing-waveform" aria-hidden="true">{Array.from({ length: 100 }, (_, i) => <i key={i} style={{ height: `${18 + ((i * 31 + i * i * 7) % 70)}%` }} />)}<div className="landing-timeline-playhead" /></div>
              <div className="landing-timeline-footer"><span><AudioLines size={13} /> {translated ? 'O‘zbekcha ovoz' : 'Original ovoz'}</span><div role="group" aria-label="Namuna matni tili"><button type="button" aria-pressed={!translated} onClick={() => setLanguage('en')}>Original</button><button type="button" aria-pressed={translated} onClick={() => setLanguage('uz')}>O‘zbekcha</button></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingView({ isAuthenticated }: LandingViewProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  useLandingReveal(pageRef);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(() => window.scrollY > 40);
  useEffect(() => {
    const handleScroll = () => {
      // Separate thresholds keep the header steady near the transition point.
      setHeaderCollapsed((collapsed) => window.scrollY > (collapsed ? 16 : 40));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  const destination = isAuthenticated ? '/dashboard' : '/signup';
  const actionText = isAuthenticated ? 'Ish maydoniga o‘tish' : 'Boshlash';
  return (
    <div className="landing-page" ref={pageRef}>
      <a className="landing-skip" href="#landing-content">Asosiy mazmunga o‘tish</a>
      <header className={`landing-header${headerCollapsed ? ' is-collapsed' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}>
        <div className="landing-header-inner">
          <Link to="/" className="landing-brand" aria-label="Dubla bosh sahifa"><Logo size={30} /><span>dubla<span className="landing-brand-domain">.uz</span></span></Link>
          <LandingNavigation isOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />
          <div className="landing-header-actions">
            {!isAuthenticated && <Link to="/signin" className="landing-signin">Kirish <MoveUpRight size={13} /></Link>}
            <Link to={destination} className="landing-button landing-button-small">{actionText}<ArrowRight size={15} /></Link>
            <button type="button" className="landing-menu-button" aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </div>
      </header>

      <div className="landing-opening">
      <section className="landing-hero landing-container" id="landing-content">
        <div className="landing-hero-content">
        <div className="landing-eyebrow">AI VIDEO DUBLYAJ</div>
        <h1>G‘oyangiz bir til bilan<br /><span>cheklanib qolmasin.</span></h1>
        <p>Dars, podkast yoki mahsulot videosi — endi boshqa tilda.<br className="landing-desktop-break" /> Tarjima, ovoz va subtitrni bitta studiyada yarating.</p>
        <div className="landing-hero-actions"><Link to={destination} className="landing-button">{isAuthenticated ? 'Studiyaga o‘tish' : 'Birinchi loyihani boshlash'}<ArrowRight size={18} /></Link><a href="#try-sample" className="landing-button landing-button-outline">Namunani sinab ko‘rish <ArrowDown size={17} /></a></div>
        </div>
      </section>

      <section className="landing-product landing-container" id="studio" aria-label="Dubla studiyasi bilan tanishing">
        <StudioPreview />
      </section>

      </div>

      <TranslationShowcase destination={destination} />

      <section className="landing-process" id="how-it-works"><div className="landing-container">
        <div className="landing-section-heading landing-heading-row" data-reveal><div><span className="landing-kicker">QANDAY ISHLAYDI?</span><h2>Sizdan video.<br />Dubla’dan yangi til.</h2></div></div>
        <div className="landing-steps">
          <article data-reveal><span className="landing-step-number">01</span><h3>Videongizni yuklang</h3><p>O‘zingizga tegishli video yoki audio faylni tanlab, yangi loyiha oching.</p></article>
          <article data-reveal><span className="landing-step-number">02</span><h3>Til va ovozni tanlang</h3><p>Transkript va tarjimani tekshiring. Har bir so‘zlovchiga mos ovozni belgilang.</p></article>
          <article data-reveal><span className="landing-step-number">03</span><h3>Natijani yuklab oling</h3><p>Tayyor dublyajni tinglang, tekshiring va keyingi loyihangizda foydalaning.</p></article>
        </div>
      </div></section>

      <section className="landing-features landing-container" id="possibilities">
        <div className="landing-section-heading" data-reveal><span className="landing-kicker">IMKONIYATLAR</span><h2>Dublyaj uchun kerakli vositalar.</h2></div>
        <div className="landing-features-layout"><div className="landing-features-grid">{features.map(({ icon: Icon, title, text }) => <article key={title} data-reveal><div className="landing-feature-topline"><Icon size={24} strokeWidth={1.5} /></div><h3>{title}</h3><p>{text}</p></article>)}</div></div>
      </section>

      <section className="landing-faq landing-container" id="faq"><div className="landing-section-heading" data-reveal><span className="landing-kicker">SAVOL-JAVOB</span><h2>Boshlashdan oldin.</h2><Link to={isAuthenticated ? '/dashboard/pricing' : '/pricing'} className="landing-text-link">Tariflarni ko‘rish <ArrowRight size={16} /></Link></div><div className="landing-questions" data-reveal>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</div></section>

      <footer className="landing-footer landing-container"><div className="landing-footer-top"><Link to="/" className="landing-brand"><Logo size={28} /><span>dubla.uz</span></Link><a href="#landing-content">Yuqoriga <ArrowRight size={14} /></a></div><div className="landing-footer-bottom"><span>© {new Date().getFullYear()} Dubla. Barcha huquqlar himoyalangan.</span><div><Link to={isAuthenticated ? '/dashboard/pricing' : '/pricing'}>Tariflar</Link><a href="#faq">Savol-javob</a><Link to={destination}>{isAuthenticated ? 'Ish maydoni' : 'Hisob ochish'}</Link></div></div></footer>
    </div>
  );
}
