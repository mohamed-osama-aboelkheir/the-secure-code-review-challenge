(function () {
  'use strict';

  var KNOWN_STATUSES = ['pending', 'processing', 'completed', 'failed'];
  var POLL_INTERVAL_MS = 2000;

  var panel = document.querySelector('[data-job-poll]');
  if (!panel) {
    return;
  }

  var jobId = panel.getAttribute('data-job-id');
  var statusEl = document.getElementById('job-status');
  var spinnerEl = document.getElementById('job-spinner');
  var waitingEl = document.getElementById('job-waiting');
  var actionsEl = document.getElementById('job-actions');
  var failedEl = document.getElementById('job-failed');

  if (!jobId || !statusEl) {
    return;
  }

  function setBusy(busy) {
    spinnerEl.hidden = !busy;
    waitingEl.hidden = !busy;
  }

  function render(status) {
    var known = KNOWN_STATUSES.indexOf(status) !== -1 ? status : 'unknown';

    // textContent, never innerHTML: the response is data, not markup.
    statusEl.textContent = status;
    statusEl.className = 'badge badge-' + known;

    setBusy(known === 'pending' || known === 'processing');
    actionsEl.hidden = known !== 'completed';
    failedEl.hidden = known !== 'failed';

    return known === 'completed' || known === 'failed';
  }

  function poll() {
    fetch('/api/convert/' + encodeURIComponent(jobId), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Status request failed: ' + response.status);
        }
        return response.json();
      })
      .then(function (job) {
        if (!render(String(job.status))) {
          window.setTimeout(poll, POLL_INTERVAL_MS);
        }
      })
      .catch(function (error) {
        console.error(error);
        setBusy(false);
      });
  }

  setBusy(true);
  window.setTimeout(poll, POLL_INTERVAL_MS);
})();
