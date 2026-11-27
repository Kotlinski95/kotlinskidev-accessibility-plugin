import type { KotlinskidevA11yConfig, PanelCredit } from "../../shared/types";
import { createElement } from "../dom";
import type { PanelContext } from "./context";

const CREDIT_PLACEHOLDER = "%s";

const buildCredit = (
  ctx: PanelContext,
  credit: PanelCredit,
): HTMLElement | null => {
  const template = ctx.t("credit");
  const split = template.indexOf(CREDIT_PLACEHOLDER);
  if (split === -1) return null;
  const link = createElement(
    ctx.doc,
    "a",
    { class: "ka11y-credit__link", href: credit.url, rel: "noopener" },
    [credit.name],
  );
  return createElement(ctx.doc, "p", { class: "ka11y-credit" }, [
    template.slice(0, split),
    link,
    template.slice(split + CREDIT_PLACEHOLDER.length),
  ]);
};

export const buildFooter = (
  ctx: PanelContext,
  config: KotlinskidevA11yConfig,
  credit?: PanelCredit,
): HTMLElement => {
  const { doc, t } = ctx;
  const status = createElement(doc, "p", { class: "ka11y-sr", role: "status" });
  const reset = createElement(
    doc,
    "button",
    { type: "button", class: "ka11y-reset" },
    [t("resetSettings")],
  );
  const onReset = (): void => {
    ctx.store.reset();
    status.textContent = t("resetDone");
  };
  ctx.listen(reset, "click", onReset);
  const creditLine = credit ? buildCredit(ctx, credit) : null;
  return createElement(doc, "footer", { class: "ka11y-foot" }, [
    reset,
    ...(config.shortcut.enabled
      ? [
          createElement(doc, "p", { class: "ka11y-hint" }, [
            `${t("shortcutHint")}: ${config.shortcut.combo}`,
          ]),
        ]
      : []),
    ...(creditLine ? [creditLine] : []),
    status,
  ]);
};
