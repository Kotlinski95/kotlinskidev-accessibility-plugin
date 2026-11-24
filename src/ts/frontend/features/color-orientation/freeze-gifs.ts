import { HOST_ID } from './overlay';

interface FrozenGif {
  image: HTMLImageElement;
  canvas: HTMLCanvasElement;
  display: string;
  priority: string;
}

const GIF_PATTERN = /\.gif(?:$|[?#])/i;

const isGif = (image: HTMLImageElement): boolean => GIF_PATTERN.test(image.currentSrc || image.src);

const snapshotOf = (image: HTMLImageElement): HTMLCanvasElement | null => {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const rect = image.getBoundingClientRect();
  if (rect.width > 0) canvas.style.width = `${rect.width}px`;
  if (rect.height > 0) canvas.style.height = `${rect.height}px`;
  canvas.className = image.className;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', image.alt);
  canvas.setAttribute('data-ka11y-frozen', '');
  return canvas;
};

const freezeOne = (image: HTMLImageElement): FrozenGif | null => {
  const canvas = snapshotOf(image);
  if (!canvas) return null;
  const frozen: FrozenGif = {
    image,
    canvas,
    display: image.style.getPropertyValue('display'),
    priority: image.style.getPropertyPriority('display'),
  };
  image.before(canvas);
  image.style.setProperty('display', 'none', 'important');
  return frozen;
};

const unfreezeOne = ({ image, canvas, display, priority }: FrozenGif): void => {
  canvas.remove();
  if (display === '') image.style.removeProperty('display');
  else image.style.setProperty('display', display, priority);
  if (image.getAttribute('style') === '') image.removeAttribute('style');
};

export const freezeGifs = (): (() => void) => {
  const frozen = [...document.querySelectorAll<HTMLImageElement>('img')]
    .filter((image) => isGif(image) && !image.closest(`#${HOST_ID}`))
    .map(freezeOne)
    .filter((item): item is FrozenGif => item !== null);
  return (): void => frozen.forEach(unfreezeOne);
};
