import { cognitiveReading } from '../../../../src/ts/frontend/features/content/cognitive-reading';
import { installFrames, resetDocument, setExcludeSelectors } from './helpers';
import type { Frames } from './helpers';

const FIXTURE = [
  '<p id="p">Hello, world! It’s 42 times</p>',
  '<script>var untouched = 1;</script>',
  '<textarea>typed words</textarea>',
  '<div id="ka11y-root"><span>widget words</span></div>',
  '<div class="skip"><span>skipped words</span></div>',
].join('');

const bolds = (): string[] => Array.from(document.querySelectorAll('b[data-ka11y-cr]')).map((node) => node.textContent ?? '');

describe('cognitiveReading', () => {
  let frames: Frames;

  beforeEach(() => {
    resetDocument();
    frames = installFrames();
    document.body.innerHTML = FIXTURE;
  });

  afterEach(() => {
    cognitiveReading.off();
    frames.restore();
  });

  it('bolds the first half of each word', () => {
    cognitiveReading.on(true);
    frames.flush();
    expect(bolds().slice(0, 4)).toEqual(['Hel', 'wor', 'It', 'tim']);
    expect(document.getElementById('p')?.textContent).toBe('Hello, world! It’s 42 times');
  });

  it('skips script, textarea, the widget root and configured selectors', () => {
    setExcludeSelectors('.skip');
    cognitiveReading.on(true);
    frames.flush();
    expect(document.querySelector('script')?.innerHTML).toBe('var untouched = 1;');
    expect(document.querySelector('textarea')?.querySelector('b')).toBeNull();
    expect(document.querySelector('#ka11y-root b')).toBeNull();
    expect(document.querySelector('.skip b')).toBeNull();
  });

  it('reverts the markup and original text nodes exactly', () => {
    const before = document.body.innerHTML;
    const original = document.getElementById('p')?.firstChild;
    cognitiveReading.on(true);
    frames.flush();
    expect(document.body.innerHTML).not.toBe(before);
    cognitiveReading.off();
    expect(document.body.innerHTML).toBe(before);
    expect(document.getElementById('p')?.firstChild).toBe(original);
    expect(document.getElementById('p')?.childNodes).toHaveLength(1);
  });

  it('reverts partial work when switched off mid-way', () => {
    document.body.innerHTML = Array.from({ length: 300 }, () => '<p>alpha beta</p>').join('');
    const before = document.body.innerHTML;
    cognitiveReading.on(true);
    frames.step();
    expect(document.querySelectorAll('b[data-ka11y-cr]').length).toBeGreaterThan(0);
    cognitiveReading.off();
    frames.flush();
    expect(document.body.innerHTML).toBe(before);
  });

  it('caps the work done per frame', () => {
    document.body.innerHTML = Array.from({ length: 300 }, () => '<p>word</p>').join('');
    cognitiveReading.on(true);
    frames.step();
    expect(document.querySelectorAll('b[data-ka11y-cr]')).toHaveLength(120);
    frames.flush();
    expect(document.querySelectorAll('b[data-ka11y-cr]')).toHaveLength(300);
  });

  it('can be switched on again after off', () => {
    cognitiveReading.on(true);
    frames.flush();
    cognitiveReading.off();
    cognitiveReading.on(true);
    frames.flush();
    expect(bolds().length).toBeGreaterThan(0);
  });
});
