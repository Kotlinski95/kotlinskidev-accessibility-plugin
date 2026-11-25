import { createElement } from "../dom";
import {
  findLandmarks,
  focusLandmark,
  type Landmark,
  type LandmarkKind,
} from "../features/color-orientation/landmarks";
import type { PanelContext } from "./context";

const SKIP_SELECT_ID = "ka11y-skip-select";
const LANDMARK_LABEL_KEYS: Readonly<Record<LandmarkKind, string>> = {
  main: "landmarkMain",
  navigation: "landmarkNavigation",
  footer: "landmarkFooter",
};

const firstLandmarkPerKind = (landmarks: Landmark[]): Landmark[] =>
  landmarks.filter(
    (landmark, index) =>
      landmarks.findIndex((other) => other.kind === landmark.kind) === index,
  );

export interface SkipCard {
  element: HTMLElement;
  refresh(): void;
}

export const buildSkipCard = (
  ctx: PanelContext,
  titleKey: string,
): SkipCard => {
  const { doc, t } = ctx;
  const select = createElement(doc, "select", {
    id: SKIP_SELECT_ID,
    class: "ka11y-select",
  });
  const element = createElement(
    doc,
    "section",
    { class: "ka11y-card", "aria-labelledby": "ka11y-card-skip", hidden: true },
    [
      createElement(
        doc,
        "h3",
        { id: "ka11y-card-skip", class: "ka11y-card__title" },
        [createElement(doc, "label", { for: SKIP_SELECT_ID }, [t(titleKey)])],
      ),
      select,
    ],
  );
  let landmarks: Landmark[] = [];
  const onSkipChange = (): void => {
    const landmark = landmarks.find((item) => item.kind === select.value);
    select.value = "";
    if (landmark) focusLandmark(landmark);
  };
  ctx.listen(select, "change", onSkipChange);
  const refresh = (): void => {
    landmarks = firstLandmarkPerKind(findLandmarks(doc));
    select.replaceChildren(
      createElement(doc, "option", { value: "" }, [t("skipChoose")]),
      ...landmarks.map((landmark) =>
        createElement(doc, "option", { value: landmark.kind }, [
          t(LANDMARK_LABEL_KEYS[landmark.kind]),
        ]),
      ),
    );
    element.hidden = landmarks.length === 0;
  };
  return { element, refresh };
};
