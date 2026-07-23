'use strict';

let token = null;
let currentUsername = null;
let currentUserId = null;

function loadStoredAuth() {
  const raw = sessionStorage.getItem('professional_auth');
  if (!raw) return;
  try {
    const auth = JSON.parse(raw);
    token = auth.token || null;
    currentUsername = auth.username || null;
    currentUserId = auth.user_id || null;
  } catch (e) { /* ignore corrupt value */ }
}

function setAuth(data) {
  token = data.token;
  currentUsername = data.username;
  currentUserId = data.user_id;
  sessionStorage.setItem('professional_auth', JSON.stringify({
    token, username: currentUsername, user_id: currentUserId,
  }));
  render();
}

function clearAuth() {
  token = null;
  currentUsername = null;
  currentUserId = null;
  sessionStorage.removeItem('professional_auth');
  render();
  loadPublicProfiles();
}

async function api(method, url, body) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error((data && data.message) || ('Request failed (' + res.status + ')'));
  }
  return data;
}

function showMessage(text, isError) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + (isError ? 'error' : 'success');
}

function hide(el) { if (el) el.classList.add('hidden'); }
function show(el) { if (el) el.classList.remove('hidden'); }

function field(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function emptyListItem(text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  return li;
}

function shortId(id) { return (id || '').slice(-6); }

function itemHeader(titleText, badgeText, badgeClass) {
  const div = document.createElement('div');
  div.className = 'item-header';
  div.appendChild(field('title', titleText));
  if (badgeText) div.appendChild(field('badge ' + badgeClass, badgeText));
  return div;
}

function itemActions(buttons) {
  const div = document.createElement('div');
  div.className = 'actions';
  buttons.forEach((btn) => div.appendChild(btn));
  return div;
}

function actionButton(text, secondary, onClick, type) {
  const btn = document.createElement('button');
  btn.type = type || 'button';
  if (secondary) btn.className = 'secondary';
  btn.textContent = text;
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

function workExperienceCard(exp) {
  const div = document.createElement('div');
  div.className = 'exp-card';
  const rows = [
    ['Company', exp.company],
    ['Role', exp.role],
    ['Location', exp.location],
    ['Time', exp.time],
    ['Description', exp.description],
  ];
  rows.forEach(([label, value]) => {
    const p = document.createElement('p');
    p.appendChild(field('exp-label', label + ': '));
    p.appendChild(field('exp-value', value || 'N/A'));
    div.appendChild(p);
  });
  return div;
}

function workExperiencesReadOnly(exps) {
  const frag = document.createDocumentFragment();
  if (exps && exps.length) {
    const heading = document.createElement('h3');
    heading.textContent = 'Work experience';
    frag.appendChild(heading);
    exps.forEach((exp) => frag.appendChild(workExperienceCard(exp)));
  }
  return frag;
}

function publicProfileItem(p) {
  const li = document.createElement('li');
  li.appendChild(itemHeader('Profile ' + shortId(p._id)));
  const bioP = document.createElement('p');
  bioP.className = 'bio';
  bioP.textContent = p.bio;
  li.appendChild(bioP);
  li.appendChild(workExperiencesReadOnly(p.work_experiences));
  return li;
}

function buildExpFieldset(container, data) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'exp-fieldset';

  const fields = [
    ['company', 'Company'],
    ['role', 'Role'],
    ['location', 'Location'],
    ['time', 'Time'],
    ['description', 'Description'],
  ];

  fields.forEach(([name, label]) => {
    const labelEl = document.createElement('label');
    labelEl.textContent = label + ' ';
    const input = document.createElement('input');
    input.name = name;
    input.value = (data && data[name]) || '';
    labelEl.appendChild(input);
    fieldset.appendChild(labelEl);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'secondary';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => fieldset.remove());
  fieldset.appendChild(removeBtn);

  container.appendChild(fieldset);
}

function collectExperiences(container) {
  return Array.from(container.querySelectorAll('.exp-fieldset')).map((fieldset) => {
    const exp = {};
    fieldset.querySelectorAll('input').forEach((input) => { exp[input.name] = input.value; });
    return exp;
  });
}

// Each "my profile" list item owns its own view/edit state, re-rendering itself in place —
// there's no separate detail/edit section, so editing never depends on re-fetching the
// profile (GET /profiles/<id> 404s for private profiles even for their owner, since that
// route has no @authenticate_token decorator; every render here works from data already in
// hand, either from /profiles/my or the just-saved PUT body).

function myProfileItem(p) {
  const li = document.createElement('li');
  renderMyProfileView(li, p);
  return li;
}

function renderMyProfileView(li, p) {
  li.textContent = '';
  li.classList.remove('editing');
  li.appendChild(itemHeader(
    'Profile ' + shortId(p._id),
    p.is_private ? 'Private' : 'Public',
    p.is_private ? 'badge-private' : 'badge-public'
  ));

  const bioP = document.createElement('p');
  bioP.className = 'bio';
  bioP.textContent = p.bio;
  li.appendChild(bioP);

  li.appendChild(workExperiencesReadOnly(p.work_experiences));

  li.appendChild(itemActions([
    actionButton('Edit', false, () => renderMyProfileEdit(li, p)),
    actionButton('Delete', true, () => deleteProfile(p._id)),
  ]));
}

function renderMyProfileEdit(li, p) {
  li.textContent = '';
  li.classList.add('editing');
  li.appendChild(itemHeader('Profile ' + shortId(p._id)));

  const form = document.createElement('form');

  const bioLabel = document.createElement('label');
  bioLabel.textContent = 'Bio';
  const bioInput = document.createElement('textarea');
  bioInput.name = 'bio';
  bioInput.rows = 3;
  bioInput.required = true;
  bioInput.value = p.bio || '';
  bioLabel.appendChild(bioInput);
  form.appendChild(bioLabel);

  const privateLabel = document.createElement('label');
  privateLabel.className = 'checkbox';
  const privateInput = document.createElement('input');
  privateInput.type = 'checkbox';
  privateInput.name = 'is_private';
  privateInput.checked = !!p.is_private;
  privateLabel.appendChild(privateInput);
  privateLabel.appendChild(document.createTextNode(' Private profile'));
  form.appendChild(privateLabel);

  const expContainer = document.createElement('div');
  expContainer.className = 'work-experiences';
  (p.work_experiences || []).forEach((exp) => buildExpFieldset(expContainer, exp));
  form.appendChild(expContainer);

  form.appendChild(actionButton('+ Add work experience', true, () => buildExpFieldset(expContainer, null)));

  form.appendChild(itemActions([
    actionButton('Save', false, null, 'submit'),
    actionButton('Cancel', true, () => renderMyProfileView(li, p)),
  ]));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updated = {
      bio: bioInput.value,
      is_private: privateInput.checked,
      work_experiences: collectExperiences(expContainer),
    };
    try {
      await api('PUT', '/profiles/' + encodeURIComponent(p._id), updated);
      showMessage('Profile updated.', false);
      renderMyProfileView(li, Object.assign({}, p, updated));
      loadPublicProfiles();
    } catch (err) { showMessage(err.message, true); }
  });

  li.appendChild(form);
}

async function loadPublicProfiles() {
  const ul = document.getElementById('public-profiles-list');
  ul.textContent = '';
  try {
    const data = await api('GET', '/profiles');
    const profiles = data.profiles || [];
    if (!profiles.length) { ul.appendChild(emptyListItem('No public profiles yet.')); return; }
    profiles.forEach((p) => ul.appendChild(publicProfileItem(p)));
  } catch (err) { showMessage(err.message, true); }
}

async function loadMyProfiles() {
  if (!token) return;
  const ul = document.getElementById('my-profiles-list');
  ul.textContent = '';
  try {
    const data = await api('GET', '/profiles/my');
    const profiles = data.profiles || [];
    if (!profiles.length) { ul.appendChild(emptyListItem('You have no profiles yet.')); return; }
    profiles.forEach((p) => ul.appendChild(myProfileItem(p)));
  } catch (err) { showMessage(err.message, true); }
}

async function deleteProfile(id) {
  if (!window.confirm('Delete this profile? This cannot be undone.')) return;
  try {
    await api('DELETE', '/profiles/' + encodeURIComponent(id));
    showMessage('Profile deleted.', false);
    loadMyProfiles();
    loadPublicProfiles();
  } catch (err) { showMessage(err.message, true); }
}

async function downloadResume() {
  try {
    const res = await fetch('/profiles/my/resume', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    });
    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch (e) { /* no body */ }
      throw new Error((data && data.message) || ('Request failed (' + res.status + ')'));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resume.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showMessage('Résumé downloaded.', false);
  } catch (err) { showMessage(err.message, true); }
}

function wireForms() {
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(loginForm);
    try {
      const data = await api('POST', '/login', { username: f.get('username'), password: f.get('password') });
      setAuth(data);
      showMessage('Login successful.', false);
      loginForm.reset();
      loadMyProfiles();
    } catch (err) { showMessage(err.message, true); }
  });

  const registerForm = document.getElementById('register-form');
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(registerForm);
    try {
      await api('POST', '/register', { username: f.get('username'), password: f.get('password') });
      showMessage('Registered successfully — you can now log in.', false);
      registerForm.reset();
    } catch (err) { showMessage(err.message, true); }
  });

  const createExpContainer = document.getElementById('create-work-experiences');
  document.getElementById('create-add-exp').addEventListener('click', () => {
    buildExpFieldset(createExpContainer, null);
  });

  const createForm = document.getElementById('create-profile-form');
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(createForm);
    try {
      await api('POST', '/profiles', {
        bio: f.get('bio'),
        is_private: createForm.elements['is_private'].checked,
        work_experiences: collectExperiences(createExpContainer),
      });
      showMessage('Profile created.', false);
      createForm.reset();
      createExpContainer.textContent = '';
      loadMyProfiles();
      loadPublicProfiles();
    } catch (err) { showMessage(err.message, true); }
  });

  document.getElementById('resume-btn').addEventListener('click', downloadResume);

  document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    clearAuth();
  });
}

function render() {
  const sessionInfo = document.getElementById('session-info');
  const logoutLink = document.getElementById('logout-link');
  const authSection = document.getElementById('auth-section');
  const registerSection = document.getElementById('register-section');
  const myProfilesSection = document.getElementById('my-profiles-section');
  const createSection = document.getElementById('create-profile-section');

  if (token) {
    sessionInfo.textContent = 'Logged in as ' + (currentUsername || '');
    show(logoutLink);
    hide(authSection);
    hide(registerSection);
    show(myProfilesSection);
    show(createSection);
  } else {
    sessionInfo.textContent = 'Not logged in';
    hide(logoutLink);
    show(authSection);
    show(registerSection);
    hide(myProfilesSection);
    hide(createSection);
  }
}

function init() {
  loadStoredAuth();
  wireForms();
  render();
  loadPublicProfiles();
  if (token) loadMyProfiles();
}

// Script is loaded with `defer`, so the DOM is already parsed here.
init();
