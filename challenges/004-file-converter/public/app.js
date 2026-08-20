(function () {
  'use strict';

  var KNOWN_STATUSES = ['pending', 'processing', 'completed', 'failed'];
  var POLL_INTERVAL_MS = 2000;

  // Job page: poll until the conversion settles.
  function initJobPolling() {
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
  }

  // Upload form: the server rejects a target format matching the input's own
  // format, so stop offering it once a file has been chosen.
  function initFormatFiltering() {
    var fileInput = document.querySelector('input[type="file"][data-accept]');
    var select = document.querySelector('select[data-target-format]');

    if (!fileInput || !select) {
      return;
    }

    fileInput.addEventListener('change', function () {
      var name = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : '';
      var dot = name.lastIndexOf('.');
      var inputFormat = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';

      var options = select.options;
      for (var i = 0; i < options.length; i++) {
        var clashes = options[i].value === inputFormat;
        options[i].disabled = clashes;
        if (clashes && options[i].selected) {
          select.selectedIndex = -1;
        }
      }
    });
  }

  initJobPolling();
  initFormatFiltering();
})();
