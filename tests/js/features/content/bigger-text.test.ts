import { biggerText } from '../../../../src/ts/frontend/features/content/bigger-text';
import { flushMutations, installFrames, resetDocument, setExcludeSelectors } from './helpers';
import type { Frames } from './helpers';
import { mountScalerFixture } from './scaler.shared';

const sizeOf = (id: string): string => (document.getElementById(id) as HTMLElement).style.fontSize;

describe('biggerText', () => {
  let frames: Frames;

  beforeEach(() => {
    resetDocument();
    frames = installFrames();
    mountScalerFixture();
  });

  afterEach(() => {
    biggerText.off();
    frames.restore();
  });

  it('exposes its key', () => {
    expect(biggerText.key).toBe('biggerText');
  });

  it('scales each element by the level factor', () => {
    biggerText.on(1);
    frames.flush();
    expect(sizeOf('a')).toBe('22px');
    expect(sizeOf('b')).toBe('11px');
    biggerText.on(2);
    frames.flush();
    expect(sizeOf('a')).toBe('25px');
    biggerText.on(3);
    frames.flush();
    expect(sizeOf('a')).toBe('30px');
    expect(sizeOf('b')).toBe('15px');
  });

  it('restores the exact markup on off', () => {
    const before = document.body.innerHTML;
    biggerText.on(3);
    frames.flush();
    expect(document.body.innerHTML).not.toBe(before);
    biggerText.off();
    expect(document.body.innerHTML).toBe(before);
  });

  it('restores original inline value and priority from the cache', () => {
    biggerText.on(2);
    frames.flush();
    const important = document.getElementById('e') as HTMLElement;
    expect(important.style.getPropertyValue('font-size')).toBe('37.5px');
    biggerText.off();
    expect(important.style.getPropertyValue('font-size')).toBe('30px');
    expect(important.style.getPropertyPriority('font-size')).toBe('important');
  });

  it('removes a style attribute it created', () => {
    const style = document.createElement('style');
    style.textContent = 'p.styled{font-size:16px}';
    document.head.append(style);
    document.body.insertAdjacentHTML('beforeend', '<p id="s" class="styled">plain</p>');
    biggerText.on(1);
    frames.flush();
    const target = document.getElementById('s') as HTMLElement;
    expect(target.style.fontSize).toBe('17.6px');
    biggerText.off();
    expect(target.hasAttribute('style')).toBe(false);
  });

  it('skips the widget root and configured selectors', () => {
    setExcludeSelectors('.skip');
    biggerText.on(3);
    frames.flush();
    expect(sizeOf('c')).toBe('20px');
    expect(sizeOf('d')).toBe('20px');
    expect(sizeOf('a')).toBe('30px');
  });

  it('ignores an invalid exclude selector', () => {
    setExcludeSelectors('][');
    biggerText.on(1);
    frames.flush();
    expect(sizeOf('a')).toBe('22px');
    expect(sizeOf('d')).toBe('20px');
  });

  it('batches writes across frames', () => {
    document.body.innerHTML = Array.from({ length: 600 }, () => '<p style="font-size:10px">t</p>').join('');
    biggerText.on(3);
    frames.step();
    const scaled = (): number =>
      Array.from(document.querySelectorAll<HTMLElement>('p')).filter((element) => element.style.fontSize !== '10px').length;
    expect(scaled()).toBeGreaterThan(0);
    expect(scaled()).toBeLessThan(600);
    frames.flush();
    expect(scaled()).toBe(600);
  });

  it('scales only added nodes and ignores non-element nodes', async () => {
    biggerText.on(3);
    frames.flush();
    document.body.append(document.createTextNode('loose'), document.createComment('c'));
    const added = document.createElement('p');
    added.style.fontSize = '20px';
    added.textContent = 'late';
    document.body.append(added);
    await flushMutations();
    frames.flush();
    expect(added.style.fontSize).toBe('30px');
    biggerText.off();
    expect(added.style.fontSize).toBe('20px');
  });

  it('stops observing after off', async () => {
    biggerText.on(1);
    frames.flush();
    biggerText.off();
    const added = document.createElement('p');
    added.style.fontSize = '20px';
    added.textContent = 'late';
    document.body.append(added);
    await flushMutations();
    frames.flush();
    expect(added.style.fontSize).toBe('20px');
  });

  it('can be switched on again after off', () => {
    biggerText.on(1);
    biggerText.off();
    biggerText.on(2);
    frames.flush();
    expect(sizeOf('a')).toBe('25px');
  });
});
