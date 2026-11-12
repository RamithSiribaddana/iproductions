import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signInWithPopup, signOut } from '@firebase/auth';
import { auth, firebaseConfigured, googleProvider, allowedAdminEmails } from './firebase.js';
import './styles.css';

const categoryLabels = {
  songs: 'Original Song',
  covers: 'Cover Record',
  commercials: 'Commercial',
  other: 'Other',
};

const navLinks = [
  ['top', 'Home'],
  ['about', 'About'],
  ['work', 'Our Work'],
  ['brands', 'Brands'],
  ['booking', 'Booking'],
];

function Swoosh() {
  return (
    <svg className="swoosh" viewBox="0 0 130 14" aria-hidden="true">
      <path d="M2 3 C 30 3, 40 12, 70 12 S 110 3, 128 3" />
    </svg>
  );
}

function SectionHead({ eyebrow, title, children, style }) {
  return (
    <div className="section-head" style={style}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <Swoosh />
      {children && <p>{children}</p>}
    </div>
  );
}

function youtubeIdFromUrl(url) {
  return url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1] || null;
}

function readImage(file) {
  if (!file) return Promise.resolve(null);
  if (!/^image\/(?:png|jpe?g|webp|gif)$/i.test(file.type)) {
    return Promise.reject(new Error('Choose a PNG, JPEG, WebP, or GIF image.'));
  }
  if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error('Images must be smaller than 2 MB.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

async function apiRequest(path, { method = 'GET', body, user } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}).`);
  }
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function App() {
  const [workItems, setWorkItems] = useState([]);
  const [brandItems, setBrandItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState('work');
  const [adminUser, setAdminUser] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [dataError, setDataError] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [workCategory, setWorkCategory] = useState('songs');
  const [submitting, setSubmitting] = useState(false);

  async function loadItems() {
    setLoadingData(true);
    const [workResult, brandResult] = await Promise.allSettled([
      apiRequest('/api/work'),
      apiRequest('/api/brands'),
    ]);
    const errors = [];
    if (workResult.status === 'fulfilled') setWorkItems(workResult.value);
    else errors.push(`Work: ${workResult.reason.message}`);
    if (brandResult.status === 'fulfilled') setBrandItems(brandResult.value);
    else errors.push(`Brands: ${brandResult.reason.message}`);
    setDataError(errors.join(' '));
    setLoadingData(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAdminUser(null);
        return;
      }
      if (user.email && allowedAdminEmails.has(user.email.trim().toLowerCase())) {
        setAdminUser(user);
        setAuthMessage('');
        setAdminOpen(true);
        return;
      }
      setAdminUser(null);
      setAuthMessage('This Google account is not authorized to manage the site.');
      signOut(auth).catch((error) => {
        console.error('Could not sign out an unauthorized account.', error);
      });
    });
  }, []);

  async function handleGoogleSignIn() {
    if (!auth || !firebaseConfigured) {
      setAuthMessage('Google sign-in is not configured. Add the Firebase values to your .env file.');
      return;
    }
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result.user.email || !allowedAdminEmails.has(result.user.email.trim().toLowerCase())) {
        await signOut(auth);
        setAuthMessage('This Google account is not authorized to manage the site.');
      } else {
        setAdminUser(result.user);
        setAdminOpen(true);
      }
    } catch (error) {
      setAuthMessage(error.message || 'Google sign-in could not be completed.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (!auth) return;
    try {
      await signOut(auth);
      setAdminOpen(false);
      setAdminMessage('');
      setAuthMessage('');
    } catch (error) {
      setAdminMessage(`Sign-out failed: ${error.message}`);
    }
  }

  async function handleAddWork(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setAdminMessage('');
    try {
      const form = new FormData(event.currentTarget);
      const title = String(form.get('title') || '').trim();
      const category = String(form.get('category') || '');
      const youtubeUrl = String(form.get('youtubeUrl') || '').trim();
      const youtubeId = category === 'songs' ? youtubeIdFromUrl(youtubeUrl) : null;
      if (!title) throw new Error('Enter a title.');
      if (category === 'songs' && !youtubeId) throw new Error('Enter a valid YouTube video URL.');

      const image = await readImage(form.get('image'));
      const link = String(form.get('link') || '').trim();
      await apiRequest('/api/work', {
        method: 'POST',
        user: adminUser,
        body: { title, category, youtubeId, image, link: link || null },
      });
      formElement.reset();
      setWorkCategory('songs');
      setAdminMessage('Work item added.');
      await loadItems();
    } catch (error) {
      setAdminMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddBrand(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setAdminMessage('');
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') || '').trim();
      const image = await readImage(form.get('image'));
      if (!name) throw new Error('Enter a brand name.');
      await apiRequest('/api/brands', {
        method: 'POST',
        user: adminUser,
        body: { name, image },
      });
      formElement.reset();
      setAdminMessage('Brand added.');
      await loadItems();
    } catch (error) {
      setAdminMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(type, item) {
    if (!window.confirm(type === 'work' ? 'Remove this from Our Work?' : 'Remove this brand?')) return;
    setAdminMessage('');
    try {
      await apiRequest(`/api/${type}?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        user: adminUser,
      });
      setAdminMessage(type === 'work' ? 'Work item deleted.' : 'Brand deleted.');
      await loadItems();
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  async function handleReorder(type, draggedId, targetId) {
    if (!draggedId || draggedId === targetId) return;
    const items = type === 'work' ? workItems : brandItems;
    const from = items.findIndex((item) => item.id === draggedId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;

    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setAdminMessage('');
    try {
      await apiRequest(`/api/${type}`, {
        method: 'PUT',
        user: adminUser,
        body: { order: reordered.map((item) => item.id) },
      });
      if (type === 'work') setWorkItems(reordered);
      else setBrandItems(reordered);
    } catch (error) {
      setAdminMessage(error.message);
    }
  }

  function handleBookingSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = ['Name', 'Email', 'Project Type', 'Preferred Date', 'Message'];
    const body = fields
      .map((field) => `${field}: ${String(form.get(field) || '').trim()}`)
      .join('\n');
    window.location.href = `mailto:book@iproductions.studio?subject=${encodeURIComponent('Studio booking request')}&body=${encodeURIComponent(body)}`;
  }

  const visibleWork = activeFilter === 'all'
    ? workItems
    : workItems.filter((item) => item.category === activeFilter);

  return (
    <>
      <nav className="site-nav">
        <input
          type="checkbox"
          id="nav-toggle"
          className="nav-toggle"
          checked={mobileNavOpen}
          onChange={(event) => setMobileNavOpen(event.target.checked)}
          aria-label="Toggle navigation"
        />
        <div className="nav-inner">
          <a href="#top" className="nav-logo" aria-label="iProductions home">
            <img src="/logo.png" alt="iProductions logo" />
          </a>
          <ul className="nav-links">
            {navLinks.map(([id, label]) => (
              <li key={id}><a href={`#${id}`} onClick={() => setMobileNavOpen(false)}>{label}</a></li>
            ))}
          </ul>
          <button
            className="login-btn"
            title={adminUser ? 'Open studio admin panel' : 'Sign in with Google'}
            type="button"
            onClick={() => { setAdminOpen(true); setAdminMessage(''); }}
          >
            {adminUser ? 'Admin Panel' : 'Login'}
          </button>
          <a href="#booking" className="nav-cta">Book Now</a>
          <label htmlFor="nav-toggle" className="nav-burger" aria-label="Toggle navigation menu">☰</label>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="spark-field" aria-hidden="true" />
        <div className="wrap hero-inner">
          <div>
            <div className="hero-logo-lockup"><img src="/logo.png" alt="iProductions" /></div>
            <h1 className="hero-title">WE PRODUCE<br />WHAT MOVES <em>PEOPLE.</em></h1>
            <Swoosh />
            <p className="hero-sub">A production studio behind the songs, covers and commercials that get remembered — not just watched. Full-service audio and video production, built around your sound.</p>
            <div className="hero-cta">
              <a href="#booking" className="btn btn-primary">Book a Session</a>
              <a href="#work" className="btn btn-ghost">View Our Work</a>
            </div>
          </div>
          <div className="hero-stats">
            <div className="stat"><b>120+</b><span>Projects Delivered</span></div>
            <div className="stat"><b>40+</b><span>Brands Served</span></div>
            <div className="stat"><b>8yrs</b><span>In the Booth</span></div>
          </div>
        </div>
        <div className="scroll-cue"><span className="line" />Scroll</div>
      </header>

      <section id="work">
        <div className="wrap work-view">
          <SectionHead eyebrow="Our Work" title={<>Songs. Covers.<br />Commercials. And more.</>}>
            A cross-section of what's come out of the studio — original productions, reimagined covers, and commercial work made for brands who needed it to land.
          </SectionHead>
          <div className="tabs" role="group" aria-label="Filter work">
            {[
              ['all', 'All Work'],
              ['songs', 'Songs'],
              ['covers', 'Covers'],
              ['commercials', 'Commercials'],
              ['other', 'Other'],
            ].map(([value, label]) => (
              <button
                className={`filter-tab${activeFilter === value ? ' active' : ''}`}
                key={value}
                type="button"
                onClick={() => setActiveFilter(value)}
                aria-pressed={activeFilter === value}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="work-grid">
            {loadingData && !workItems.length
              ? <div className="work-empty">Loading our work…</div>
              : visibleWork.length
                ? visibleWork.map((item, index) => {
                  const link = item.category === 'songs' && item.youtubeId
                    ? `https://www.youtube.com/watch?v=${item.youtubeId}`
                    : item.link;
                  const thumbnail = item.category === 'songs' && item.youtubeId
                    ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`
                    : item.image;
                  const content = (
                    <>
                      <div
                        className="work-thumb"
                        data-mark={String(index + 1).padStart(2, '0')}
                        style={thumbnail ? { backgroundImage: `url("${thumbnail}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                      >
                        {link && <span className="play" />}
                      </div>
                      <div className="work-info">
                        <h4>{item.title}</h4>
                        <span>{categoryLabels[item.category] || 'Other'}</span>
                      </div>
                    </>
                  );
                  return link
                    ? <a className="work-card clickable" data-cat={item.category} href={link} key={item.id} target="_blank" rel="noreferrer">{content}</a>
                    : <article className="work-card" data-cat={item.category} key={item.id}>{content}</article>;
                })
                : <div className="work-empty">{dataError ? 'Work could not be loaded. Please try again later.' : 'Nothing published yet — add the first piece of work from the Admin panel.'}</div>}
          </div>
        </div>
      </section>

      <section className="section-alt" id="brands">
        <div className="wrap">
          <SectionHead eyebrow="Trusted By" title="Brands we've worked with" style={{ marginBottom: 50 }} />
        </div>
        <div className="brand-marquee">
          <div className="brand-track" style={!brandItems.length ? { animation: 'none' } : undefined}>
            {brandItems.length
              ? [...brandItems, ...brandItems].map((brand, index) => (
                <span className="brand-chip" key={`${brand.id}-${index}`}>
                  {brand.image ? <img src={brand.image} alt={brand.name} /> : brand.name}
                </span>
              ))
              : <span className="brand-empty">{dataError ? 'Brands could not be loaded.' : 'Add your first brand from the Admin panel.'}</span>}
          </div>
        </div>
      </section>

      <section id="booking">
        <div className="wrap">
          <SectionHead eyebrow="Booking" title="Let's produce something.">
            Tell us about the project and preferred dates. We'll follow up within one business day to lock in your session.
          </SectionHead>
          <div className="booking-shell">
            <div className="booking-side">
              <div>
                <h3>Reach the studio directly</h3>
                <p>Prefer to talk it through first? Call, email, or message the studio and we'll figure out the right session for your project.</p>
              </div>
              <div className="booking-contacts">
                <div><b>Phone</b><span>+94 77 10 72 369</span></div>
                <div><b>Email</b><span>i.productionskandy@gmail.com</span></div>
                <div><b>Studio</b><span>779/A/1/1, Peradeniya Road, Kandy</span></div>
                <div><b>Hours</b><span>Mon–Fri, 10:00–20:00</span></div>
              </div>
            </div>
            <form className="booking-form" onSubmit={handleBookingSubmit}>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="bk-name">Full Name</label>
                  <input type="text" id="bk-name" name="Name" placeholder="Your name" required />
                </div>
                <div className="field">
                  <label htmlFor="bk-email">Email</label>
                  <input type="email" id="bk-email" name="Email" placeholder="you@email.com" required />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="bk-type">Project Type</label>
                  <select id="bk-type" name="Project Type">
                    <option>Original Song</option>
                    <option>Cover Record</option>
                    <option>Commercial</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="bk-date">Preferred Date</label>
                  <input type="date" id="bk-date" name="Preferred Date" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="bk-msg">Project Details</label>
                <textarea id="bk-msg" name="Message" placeholder="Tell us about the project, timeline and references..." />
              </div>
              <div className="form-foot">
                <p className="form-note">Submitting opens your email client with the details pre-filled, ready to send to the studio.</p>
                <button type="submit" className="btn btn-primary">Send Booking Request</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section id="about" className="section-alt">
        <div className="wrap">
          <div className="footer-about">
            <div className="footer-about-image">
              <img src="/images/owner.jpg" alt="Isuru Withanage — Founder" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
            </div>
            <div className="footer-about-content">
              <h3>Isuru Withanage</h3>
              <span className="role">Founder &amp; Creative Director</span>
              <p>iProductions is built on a simple philosophy: production serves the story, not the other way around. Every project is handled personally, from the first session to the final master, ensuring your vision is heard exactly as intended.</p>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="footer-top">
            <a href="#top" className="footer-logo" aria-label="iProductions home"><img src="/logo.png" alt="iProductions logo" /></a>
            <ul className="footer-links">
              {navLinks.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
            </ul>
            <div className="footer-social">
              <a href="#" aria-label="Instagram">IG</a>
              <a href="#" aria-label="YouTube">YT</a>
              <a href="#" aria-label="TikTok">TT</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 iProductions. All rights reserved.</span>
            <span>Built for studios that finish what they start.</span>
          </div>
        </div>
      </footer>

      {adminOpen && (
        <div className="admin-modal active" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminOpen(false); }}>
          <div className="admin-content" role="dialog" aria-modal="true" aria-labelledby="admin-title">
            <div className="admin-header">
              <div>
                <h2 id="admin-title">Studio Admin Panel</h2>
                <p>Manage everything shown in the Our Work and Brands sections.</p>
              </div>
              <button className="admin-close" onClick={() => setAdminOpen(false)} aria-label="Close admin panel" type="button">&times;</button>
            </div>

            {!adminUser ? (
              <div className="admin-login">
                <h3 className="admin-subhead">Owner sign-in</h3>
                <p className="admin-hint">Only the Google account configured as the site owner can manage content.</p>
                {authMessage && <p className="admin-feedback" role="alert">{authMessage}</p>}
                <button className="admin-btn-submit" type="button" onClick={handleGoogleSignIn} disabled={authBusy}>
                  {authBusy ? 'Signing in…' : 'Continue with Google'}
                </button>
              </div>
            ) : (
              <>
                <div className="admin-session">
                  <span>Signed in as {adminUser.email}</span>
                  <button type="button" className="admin-signout" onClick={handleSignOut}>Sign out</button>
                </div>
                <div className="admin-tabs">
                  <button className={`admin-tab${adminTab === 'work' ? ' active' : ''}`} onClick={() => setAdminTab('work')} type="button">Our Work</button>
                  <button className={`admin-tab${adminTab === 'brands' ? ' active' : ''}`} onClick={() => setAdminTab('brands')} type="button">Brands</button>
                </div>
                {adminMessage && <p className="admin-feedback" role="status">{adminMessage}</p>}

                {adminTab === 'work' ? (
                  <div className="admin-tab-content active">
                    <h3 className="admin-subhead">Add to Our Work</h3>
                    <form onSubmit={handleAddWork}>
                      <div className="admin-form-row">
                        <div className="admin-form-group">
                          <label htmlFor="work-title">Title *</label>
                          <input id="work-title" name="title" placeholder="e.g., Nightfall Radio" maxLength="160" required />
                        </div>
                        <div className="admin-form-group">
                          <label htmlFor="work-category">Category *</label>
                          <select id="work-category" name="category" value={workCategory} onChange={(event) => setWorkCategory(event.target.value)} required>
                            <option value="songs">Song</option>
                            <option value="covers">Cover</option>
                            <option value="commercials">Commercial</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      {workCategory === 'songs' ? (
                        <div className="admin-conditional is-visible">
                          <div className="admin-form-group">
                            <label htmlFor="youtube-url">YouTube Video URL *</label>
                            <input id="youtube-url" name="youtubeUrl" type="url" placeholder="https://www.youtube.com/watch?v=..." required />
                          </div>
                          <p className="admin-hint">The thumbnail and click-through link are pulled from the YouTube video.</p>
                        </div>
                      ) : (
                        <div className="admin-conditional is-visible">
                          <div className="admin-form-group">
                            <label htmlFor="work-image">Cover Image (optional, max 2 MB)</label>
                            <input id="work-image" name="image" type="file" accept="image/*" />
                          </div>
                          <div className="admin-form-group">
                            <label htmlFor="work-link">Link (optional)</label>
                            <input id="work-link" name="link" type="url" placeholder="Link to the full video, if there is one" />
                          </div>
                        </div>
                      )}
                      <button type="submit" className="admin-btn-submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add to Our Work'}</button>
                    </form>
                    <h3 className="admin-subhead admin-subhead-spaced">Manage Work</h3>
                    <AdminList
                      items={workItems}
                      type="work"
                      emptyText="No work items yet. Add your first one above."
                      onDelete={handleDelete}
                      onReorder={handleReorder}
                    />
                  </div>
                ) : (
                  <div className="admin-tab-content active">
                    <h3 className="admin-subhead">Add a Brand</h3>
                    <form onSubmit={handleAddBrand}>
                      <div className="admin-form-group">
                        <label htmlFor="brand-name">Brand Name *</label>
                        <input id="brand-name" name="name" placeholder="e.g., Solara Coffee" maxLength="120" required />
                      </div>
                      <div className="admin-form-group">
                        <label htmlFor="brand-image">Brand Logo (optional, max 2 MB)</label>
                        <input id="brand-image" name="image" type="file" accept="image/*" />
                      </div>
                      <p className="admin-hint">Without a logo, the brand appears as a text wordmark.</p>
                      <button type="submit" className="admin-btn-submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Brand'}</button>
                    </form>
                    <h3 className="admin-subhead admin-subhead-spaced">Manage Brands</h3>
                    <AdminList
                      items={brandItems}
                      type="brands"
                      emptyText="No brands yet. Add your first one above."
                      onDelete={handleDelete}
                      onReorder={handleReorder}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function AdminList({ items, type, emptyText, onDelete, onReorder }) {
  if (!items.length) return <div className="admin-empty">{emptyText}</div>;
  return (
    <div className="admin-list">
      {items.map((item) => {
        const title = type === 'work' ? item.title : item.name;
        const image = type === 'work' && item.category === 'songs' && item.youtubeId
          ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`
          : item.image;
        return (
          <div
            className="admin-item"
            key={item.id}
            draggable
            onDragStart={(event) => { event.dataTransfer.setData('text/plain', item.id); }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onReorder(type, event.dataTransfer.getData('text/plain'), item.id);
            }}
          >
            <div className="admin-item-drag-handle" aria-label="Drag to reorder">≡</div>
            <div className="admin-item-thumb" style={image ? { backgroundImage: `url("${image}")` } : undefined}>
              {!image && title.charAt(0)}
            </div>
            <div className="admin-item-info">
              <div className="admin-item-title">{title}</div>
              <div className="admin-item-cat">{type === 'work' ? categoryLabels[item.category] : 'Brand'}</div>
            </div>
            <button type="button" className="admin-item-delete" onClick={() => onDelete(type, item)}>Delete</button>
          </div>
        );
      })}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
