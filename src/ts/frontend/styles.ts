declare const __KA11Y_WIDGET_CSS__: string;

export const CUSTOM_CSS_ID = 'ka11y-custom-css';

export const widgetCss = (): string => (typeof __KA11Y_WIDGET_CSS__ === 'string' ? __KA11Y_WIDGET_CSS__ : '');

const createStyle = (doc: Document, css: string): HTMLStyleElement => {
  const style = doc.createElement('style');
  style.textContent = css;
  return style;
};

export const injectShadowStyles = (shadow: ShadowRoot, doc: Document, customCss: string): void => {
  shadow.append(createStyle(doc, widgetCss()));
  if (customCss.trim() !== '') shadow.append(createStyle(doc, customCss));
};

export const injectDocumentCustomCss = (doc: Document, customCss: string): void => {
  if (customCss.trim() === '' || doc.getElementById(CUSTOM_CSS_ID)) return;
  const style = createStyle(doc, customCss);
  style.id = CUSTOM_CSS_ID;
  doc.head.append(style);
};
