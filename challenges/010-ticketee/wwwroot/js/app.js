(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  function initBoard() {
    var form = document.getElementById("move-form");
    if (!form) return;

    var dragged = null;

    document.querySelectorAll(".issue-card[draggable]").forEach(function (card) {
      card.addEventListener("dragstart", function (e) {
        dragged = card;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.dataset.issue);
      });
      card.addEventListener("dragend", function () {
        card.classList.remove("dragging");
        dragged = null;
      });
    });

    document.querySelectorAll(".column").forEach(function (column) {
      var body = column.querySelector(".column-body");
      column.addEventListener("dragover", function (e) {
        if (!dragged) return;
        e.preventDefault();
        column.classList.add("drop-target");
      });
      column.addEventListener("dragleave", function (e) {
        if (!column.contains(e.relatedTarget)) column.classList.remove("drop-target");
      });
      column.addEventListener("drop", function (e) {
        e.preventDefault();
        column.classList.remove("drop-target");
        if (!dragged) return;
        if (dragged.closest(".column") === column) return;

        var empty = body.querySelector(".column-empty");
        if (empty) empty.remove();
        body.appendChild(dragged);

        form.elements.IssueKey.value = dragged.dataset.issue;
        form.elements.Status.value = column.dataset.status;
        form.submit();
      });
    });
  }

  function initSelection() {
    var all = document.querySelector("[data-select-all]");
    var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-select]"));
    var button = document.querySelector("[data-open-selected]");
    if (!button) return;

    function sync() {
      var count = boxes.filter(function (b) { return b.checked; }).length;
      button.disabled = count === 0;
      button.textContent = count > 0 ? "Open selected (" + count + ")" : "Open selected";
      if (all) all.checked = count > 0 && count === boxes.length;
    }

    boxes.forEach(function (b) { b.addEventListener("change", sync); });
    if (all) {
      all.addEventListener("change", function () {
        boxes.forEach(function (b) { b.checked = all.checked; });
        sync();
      });
    }
    sync();
  }

  function initAutosubmit() {
    document.querySelectorAll("[data-autosubmit]").forEach(function (el) {
      el.addEventListener("change", function () { el.form.submit(); });
    });
  }

  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(btn.dataset.copy).then(function () {
          var label = btn.textContent;
          btn.textContent = "Copied!";
          setTimeout(function () { btn.textContent = label; }, 1500);
        });
      });
    });
  }

  ready(function () {
    initBoard();
    initSelection();
    initAutosubmit();
    initCopy();
  });
})();
