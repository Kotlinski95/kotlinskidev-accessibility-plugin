import { computePlacement, createPreview } from '../../../src/ts/admin/preview';
import { createFormState } from '../../../src/ts/admin/state';
import { change, sampleDefaults } from './helpers';

jest.mock('@wordpress/i18n', () => jest.requireActual('./wp-mocks').i18nMock, { virtual: true });

describe('preview', () => {
  it('computes placements', () => {
    expect(computePlacement('bottom-right', 20, 30, 0.5).style).toMatchObject({ right: '10px', bottom: '15px', left: 'auto', top: 'auto' });
    expect(computePlacement('top-left', 20, 30, 1).style).toMatchObject({ left: '20px', top: '30px', bottom: 'auto' });
    expect(computePlacement('middle-left', 20, 30, 1).style).toMatchObject({ left: '20px', top: '50%', transform: 'translateY(-50%)' });
  });

  it('reflects state, tokens and device visibility', () => {
    const state = createFormState(sampleDefaults());
    const preview = createPreview(state);
    document.body.replaceChildren(preview.element);
    const launcher = preview.element.querySelector('.ka11y-preview__launcher') as HTMLElement;
    expect(launcher.style.right).not.toBe('auto');
    state.set('widget.position.desktop', 'top-left');
    expect(launcher.style.left).not.toBe('auto');
    expect(launcher.style.top).not.toBe('auto');
    state.set('tokens.primary', '#123456');
    expect(preview.element.style.getPropertyValue('--ka11y-primary')).toBe('#123456');
    state.set('tokens.headerBg', '#222222');
    expect(preview.element.style.getPropertyValue('--ka11y-header-bg')).toBe('#222222');
    expect(preview.element.querySelectorAll('.ka11y-preview__sample')).toHaveLength(2);
    state.set('widget.iconBorder', true);
    expect(launcher.classList.contains('has-border')).toBe(true);
    const select = preview.element.querySelector('select') as HTMLSelectElement;
    state.set('visibility.devices.mobile', false);
    select.value = 'mobile';
    change(select, 'change');
    expect(preview.device()).toBe('mobile');
    expect((preview.element.querySelector('.ka11y-preview__frame') as HTMLElement).hidden).toBe(true);
    expect((preview.element.querySelector('.ka11y-preview__hidden') as HTMLElement).hidden).toBe(false);
  });

  it('scales the launcher from the numeric rem size and hides it when the launcher is hidden', () => {
    const state = createFormState(sampleDefaults());
    const preview = createPreview(state);
    document.body.replaceChildren(preview.element);
    const launcher = preview.element.querySelector('.ka11y-preview__launcher') as HTMLElement;
    const medium = launcher.style.width;
    state.set('widget.sizeRem', 5);
    expect(parseInt(launcher.style.width, 10)).toBeGreaterThan(parseInt(medium, 10));
    state.set('widget.sizeRem', '');
    expect(launcher.style.width).toBe(medium);
    state.set('widget.sizesRem.desktop', 1.5);
    expect(parseInt(launcher.style.width, 10)).toBeLessThan(parseInt(medium, 10));
    state.set('widget.sizesRem.desktop', '');
    expect(launcher.hidden).toBe(false);
    state.set('widget.launcher', 'hidden');
    expect(launcher.hidden).toBe(true);
    expect(preview.element.querySelector('.ka11y-preview__launcher-note')?.hasAttribute('hidden')).toBe(false);
  });
});
