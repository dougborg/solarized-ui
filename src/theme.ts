const themes = [
  { mode: "auto", label: "Auto (system theme)", glyph: "\uf108" },
  { mode: "light", label: "Light", glyph: "\uf185" },
  { mode: "dark", label: "Dark", glyph: "\uf186" },
] as const;

const button = document.querySelector<HTMLButtonElement>("#theme-toggle");
const icon = button?.querySelector<HTMLSpanElement>(".nerd-icon");
const storageKey = "solarized-ui-theme";

function initialTheme() {
  try {
    const saved = localStorage.getItem(storageKey);
    const index = themes.findIndex((theme) => theme.mode === saved);
    if (index >= 0) return index;
  } catch {
    // Storage can be unavailable or denied; the control must still work.
  }
  return themes.findIndex((theme) => theme.mode === "dark");
}

if (button && icon && CSS.supports("color", "light-dark(white, black)")) {
  let selected = initialTheme();
  const update = () => {
    const current = themes[selected];
    const next = themes[(selected + 1) % themes.length];
    document.documentElement.dataset.theme = current.mode;
    icon.textContent = current.glyph;
    const label = `Theme: ${current.label}. Switch to ${next.label}.`;
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  button.addEventListener("click", () => {
    selected = (selected + 1) % themes.length;
    update();
    try {
      localStorage.setItem(storageKey, themes[selected].mode);
    } catch {
      // Keep the visitor's selection for this page even when it cannot be saved.
    }
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && icon.animate) {
      for (const animation of icon.getAnimations()) animation.cancel();
      icon.animate([{ transform: "rotate(-90deg)" }, { transform: "rotate(0deg)" }], {
        duration: 180,
        easing: "ease-out",
      });
    }
  });

  update();
  button.hidden = false;
}
