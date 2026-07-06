'use strict';

const ROLE = document.body.dataset.role;

async function api(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error((data && data.error) || ('Request failed (' + res.status + ')'));
  }
  return data;
}

function showMessage(text, isError) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.className = 'message ' + (isError ? 'error' : 'success');
}

function textSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function emptyItem(text) {
  const li = document.createElement('li');
  li.className = 'empty';
  li.textContent = text;
  return li;
}

function courseItem(c) {
  const li = document.createElement('li');
  li.appendChild(textSpan('title', c.title));
  li.appendChild(textSpan(
    'meta',
    ' — ' + c.description +
    ' (teacher: ' + (c.teacher_name || 'n/a') +
    ', ' + c.enrolled_students + '/' + c.student_limit + ' enrolled)'
  ));
  if (ROLE === 'student' || ROLE === 'admin') {
    const btn = document.createElement('button');
    btn.textContent = 'Enroll';
    btn.addEventListener('click', () => enroll(c.id));
    li.appendChild(btn);
  }
  return li;
}

function enrollmentItem(c) {
  const li = document.createElement('li');
  li.appendChild(textSpan('title', c.title));
  li.appendChild(textSpan('meta', ' — teacher: ' + (c.teacher_name || 'n/a')));
  return li;
}

function userItem(u) {
  const li = document.createElement('li');
  li.appendChild(textSpan('title', u.username));
  li.appendChild(textSpan('meta', ' — ' + u.email + ' '));
  li.appendChild(textSpan('role-badge role-' + u.role, u.role));
  if (u.role !== 'admin') {
    const btn = document.createElement('button');
    btn.textContent = 'Promote to admin';
    btn.addEventListener('click', () => promote(u.id));
    li.appendChild(btn);
  }
  return li;
}

async function loadCourses() {
  const ul = document.getElementById('courses');
  if (!ul) return;
  ul.textContent = '';
  try {
    const courses = await api('GET', '/api/courses');
    if (!courses.length) { ul.appendChild(emptyItem('No available courses right now.')); return; }
    courses.forEach((c) => ul.appendChild(courseItem(c)));
  } catch (err) { showMessage(err.message, true); }
}

async function loadEnrollments() {
  const ul = document.getElementById('enrollments');
  if (!ul) return;
  ul.textContent = '';
  try {
    const items = await api('GET', '/api/courses/user/enrollments');
    if (!items.length) { ul.appendChild(emptyItem('You are not enrolled in any courses.')); return; }
    items.forEach((c) => ul.appendChild(enrollmentItem(c)));
  } catch (err) { showMessage(err.message, true); }
}

async function loadUsers() {
  const ul = document.getElementById('users');
  if (!ul) return;
  ul.textContent = '';
  try {
    const users = await api('GET', '/api/admin/users');
    users.forEach((u) => ul.appendChild(userItem(u)));
  } catch (err) { showMessage(err.message, true); }
}

async function enroll(id) {
  try {
    await api('POST', '/api/courses/' + id + '/enroll');
    showMessage('Enrolled.', false);
    loadCourses();
    loadEnrollments();
  } catch (err) { showMessage(err.message, true); }
}

async function promote(id) {
  try {
    await api('POST', '/api/admin/users/' + id + '/promote');
    showMessage('User promoted.', false);
    loadUsers();
  } catch (err) { showMessage(err.message, true); }
}

function wireForms() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(loginForm);
      try {
        await api('POST', '/api/auth/login', { username: f.get('username'), password: f.get('password') });
        window.location.assign('/');
      } catch (err) { showMessage(err.message, true); }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(registerForm);
      try {
        await api('POST', '/api/auth/register', {
          username: f.get('username'),
          email: f.get('email'),
          password: f.get('password'),
          role: f.get('role'),
        });
        window.location.assign('/');
      } catch (err) { showMessage(err.message, true); }
    });
  }

  const courseForm = document.getElementById('create-course-form');
  if (courseForm) {
    courseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(courseForm);
      try {
        await api('POST', '/api/courses', {
          title: f.get('title'),
          description: f.get('description'),
          studentLimit: Number(f.get('studentLimit')),
          startDate: f.get('startDate'),
          endDate: f.get('endDate'),
        });
        showMessage('Course created.', false);
        courseForm.reset();
        loadCourses();
      } catch (err) { showMessage(err.message, true); }
    });
  }
}

function init() {
  wireForms();
  if (!ROLE) return; // logged out
  loadCourses();
  if (ROLE === 'student' || ROLE === 'admin') loadEnrollments();
  if (ROLE === 'admin') loadUsers();
}

// Script is loaded with `defer`, so the DOM is already parsed here.
init();
