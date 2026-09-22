const themes = [
  { mode: "auto", label: "Auto (system theme)", glyph: "\uf108" },
  { mode: "light", label: "Light", glyph: "\uf185" },
  { mode: "dark", label: "Dark", glyph: "\uf186" },
] as const;

const button = document.querySelector<HTMLButtonElement>("#theme-toggle");
const icon = button?.querySelector<HTMLSpanElement>(".nerd-icon");

if (button && icon && CSS.supports("color", "light-dark(white, black)")) {
  let selected = 0;
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
