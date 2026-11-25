import type { FeatureConfig, PanelSectionName } from "../../shared/types";
import { createElement } from "../dom";
import { FEATURE_GROUPS } from "../feature-groups";
import type { Profiles } from "../profiles";
import type { Control, PanelContext } from "./context";
import { buildStepper, STEPPER_FEATURES } from "./stepper";
import { buildFeatureTile, buildProfileTile } from "./tile";

const SKIP_FEATURE_KEY = "skipToContent";

export interface Cards {
  elements: HTMLElement[];
  controls: Control[];
}

const buildCard = (
  ctx: PanelContext,
  id: string,
  title: string,
  controls: Control[],
): HTMLElement => {
  const titleId = `ka11y-card-${id}`;
  return createElement(
    ctx.doc,
    "section",
    { class: "ka11y-card", "aria-labelledby": titleId },
    [
      createElement(
        ctx.doc,
        "h3",
        { id: titleId, class: "ka11y-card__title" },
        [title],
      ),
      createElement(
        ctx.doc,
        "div",
        { class: "ka11y-tiles" },
        controls.flatMap((control) => control.nodes),
      ),
    ],
  );
};

const isEnabled = (
  features: Record<string, FeatureConfig>,
  key: string,
): boolean => features[key]?.enabled === true;

const byStepperFirst = (a: string, b: string): number =>
  Number(STEPPER_FEATURES.has(b)) - Number(STEPPER_FEATURES.has(a));

export const buildCards = (
  ctx: PanelContext,
  features: Record<string, FeatureConfig>,
  profiles: Profiles,
  sections: Record<PanelSectionName, boolean>,
): Cards => {
  const elements: HTMLElement[] = [];
  const controls: Control[] = [];
  const add = (id: string, title: string, items: Control[]): void => {
    if (items.length === 0) return;
    controls.push(...items);
    elements.push(buildCard(ctx, id, title, items));
  };
  if (sections.profiles) {
    add(
      "profiles",
      ctx.t("profilesTitle"),
      profiles.keys().map((key) => buildProfileTile(ctx, profiles, key)),
    );
  }
  FEATURE_GROUPS.forEach((group) => {
    if (!sections[group.id]) return;
    const keys = group.features
      .filter((key) => key !== SKIP_FEATURE_KEY && isEnabled(features, key))
      .sort(byStepperFirst);
    add(
      group.id,
      ctx.t(group.titleKey),
      keys.map((key) =>
        STEPPER_FEATURES.has(key)
          ? buildStepper(ctx, key)
          : buildFeatureTile(ctx, key),
      ),
    );
  });
  return { elements, controls };
};
