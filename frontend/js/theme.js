// Applied immediately (before the rest of the page renders) to avoid a
// flash of the wrong theme. This script tag must be placed in <head>.
(function () {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
})();

function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  btn.title = current === "dark" ? "Switch to light mode" : "Switch to dark mode";
}

function setupThemeToggle() {
  const btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;

  updateThemeIcon();

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeIcon();
  });
}

document.addEventListener("DOMContentLoaded", setupThemeToggle);
