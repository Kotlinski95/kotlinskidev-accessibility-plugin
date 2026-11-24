import type { InlineConfig } from '../shared/types';

export const whenDeviceVisible = (config: InlineConfig, onVisible: () => void): void => {
  const hidden = config.load.deviceSkip && config.hiddenMedia !== '' && typeof matchMedia === 'function';
  const query = hidden ? matchMedia(config.hiddenMedia) : null;
  if (!query || !query.matches) {
    onVisible();
    return;
  }
  const onChange = (): void => {
    if (query.matches) return;
    query.removeEventListener('change', onChange);
    onVisible();
  };
  query.addEventListener('change', onChange);
};
