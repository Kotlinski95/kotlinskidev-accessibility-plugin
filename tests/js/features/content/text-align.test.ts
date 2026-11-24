import { textAlign } from '../../../../src/ts/frontend/features/content/text-align';
import { resetDocument } from './helpers';

const classes = (): string => document.documentElement.className;

describe('textAlign', () => {
  beforeEach(resetDocument);

  it('cycles left, center and right', () => {
    textAlign.on(1);
    expect(classes()).toBe('ka11y-align-left');
    textAlign.on(2);
    expect(classes()).toBe('ka11y-align-center');
    textAlign.on(3);
    expect(classes()).toBe('ka11y-align-right');
    textAlign.off();
  });

  it('treats a boolean level as left and clamps high levels', () => {
    textAlign.on(true);
    expect(classes()).toBe('ka11y-align-left');
    textAlign.on(9);
    expect(classes()).toBe('ka11y-align-right');
    textAlign.off();
  });

  it('removes every alignment class on off and keeps foreign classes', () => {
    document.documentElement.classList.add('keep');
    textAlign.on(2);
    textAlign.off();
    expect(classes()).toBe('keep');
    document.documentElement.classList.remove('keep');
    textAlign.on(1);
    textAlign.off();
    expect(document.documentElement.hasAttribute('class')).toBe(false);
  });
});
