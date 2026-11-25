import { buildSnippets, classTokens, shortcodeLabel } from '../../../src/ts/admin/snippets';
import type { SnippetInput } from '../../../src/ts/admin/snippets';

const input = (overrides: Partial<SnippetInput> = {}): SnippetInput => ({
  action: 'profile:adhdFriendly',
  label: 'Focus mode',
  element: 'button',
  extraClass: '',
  homeUrl: 'https://example.com/',
  urlActions: ['open', 'feature', 'profile'],
  ...overrides,
});

const ACTIONS = ['open', 'close', 'toggle', 'reset', 'statement', 'hide', 'show', 'feature:biggerText', 'feature:biggerText:2', 'profile:adhdFriendly'];

describe('snippet outputs', () => {
  it('builds the documented example for each output', () => {
    expect(buildSnippets(input())).toEqual({
      html: '<button type="button" data-ka11y="profile:adhdFriendly">Focus mode</button>',
      link: '<a href="#ka11y/profile:adhdFriendly" data-ka11y="profile:adhdFriendly" role="button">Focus mode</a>',
      shortcode: '[kotlinskidev_a11y_button action="profile:adhdFriendly" label="Focus mode"]',
      php: "<?php kotlinskidev_a11y_button( array( 'action' => 'profile:adhdFriendly', 'label' => 'Focus mode' ) ); ?>",
      javascript: "kotlinskidevA11y.toggle('profile:adhdFriendly');",
      url: 'https://example.com/?ka11y=profile%3AadhdFriendly',
    });
  });

  it.each(ACTIONS)('puts %s in every output', (action) => {
    const snippets = buildSnippets(input({ action }));
    expect(snippets.html).toContain(`data-ka11y="${action}"`);
    expect(snippets.link).toContain(`href="#ka11y/${action}"`);
    expect(snippets.shortcode).toContain(`action="${action}"`);
    expect(snippets.php).toContain(`'action' => '${action}'`);
  });

  it('uses the direct JavaScript method for dialog actions', () => {
    expect(buildSnippets(input({ action: 'open' })).javascript).toBe('kotlinskidevA11y.open();');
    expect(buildSnippets(input({ action: 'close' })).javascript).toBe('kotlinskidevA11y.close();');
    expect(buildSnippets(input({ action: 'toggle' })).javascript).toBe('kotlinskidevA11y.toggle();');
    expect(buildSnippets(input({ action: 'feature:biggerText:2' })).javascript).toBe("kotlinskidevA11y.toggle('feature:biggerText:2');");
  });

  it('adds the element, class and omits an empty label for shortcode and PHP', () => {
    const snippets = buildSnippets(input({ label: '', element: 'link', extraClass: 'btn  is-style-outline' }));
    expect(snippets.shortcode).toBe('[kotlinskidev_a11y_button action="profile:adhdFriendly" element="link" class="btn is-style-outline"]');
    expect(snippets.php).toBe("<?php kotlinskidev_a11y_button( array( 'action' => 'profile:adhdFriendly', 'element' => 'link', 'class' => 'btn is-style-outline' ) ); ?>");
    expect(snippets.html).toContain('class="btn is-style-outline"');
  });
});

describe('snippet escaping', () => {
  const label = `A "quoted" <b>'x'</b> ]end[ \\`;

  it('escapes HTML text in html and link', () => {
    const snippets = buildSnippets(input({ label }));
    expect(snippets.html).toContain('A &quot;quoted&quot; &lt;b&gt;&#039;x&#039;&lt;/b&gt; ]end[ \\<');
    expect(snippets.html).not.toContain('<b>');
    expect(snippets.link).not.toContain('<b>');
  });

  it('strips quotes and brackets from shortcode labels', () => {
    expect(shortcodeLabel(label)).toBe("A quoted <b>'x'</b> end \\");
    const shortcode = buildSnippets(input({ label })).shortcode as string;
    expect(shortcode.match(/"/g)).toHaveLength(4);
    expect(shortcode.endsWith(']')).toBe(true);
    expect(shortcode.slice(0, -1)).not.toContain(']');
  });

  it('escapes single quotes and backslashes for PHP and JavaScript strings', () => {
    const snippets = buildSnippets(input({ label: "it's \\ ok" }));
    expect(snippets.php).toContain("'label' => 'it\\'s \\\\ ok'");
  });

  it('keeps only safe class tokens', () => {
    expect(classTokens('a"><script> b b c-d_e')).toEqual(['ascript', 'b', 'c-d_e']);
    expect(buildSnippets(input({ extraClass: '"><img onerror=x>' })).html).not.toContain('<img');
  });

  it('caps the label at 100 characters', () => {
    const snippets = buildSnippets(input({ label: 'x'.repeat(150) }));
    expect(snippets.html).toContain(`>${'x'.repeat(100)}<`);
  });

  it('flattens control characters in labels', () => {
    expect(buildSnippets(input({ label: 'a\nb' })).php).toContain("'label' => 'a b'");
  });
});

describe('url output', () => {
  it.each(['open', 'feature:biggerText', 'feature:biggerText:2', 'profile:adhdFriendly'])('is built for %s', (action) => {
    expect(buildSnippets(input({ action })).url).toBe(`https://example.com/?ka11y=${encodeURIComponent(action)}`);
  });

  it.each(['close', 'toggle', 'reset', 'statement', 'hide', 'show'])('is null for %s', (action) => {
    expect(buildSnippets(input({ action })).url).toBeNull();
  });

  it('follows the saved URL action list', () => {
    expect(buildSnippets(input({ action: 'open', urlActions: [] })).url).toBeNull();
    expect(buildSnippets(input({ action: 'profile:x', urlActions: ['open'] })).url).toBeNull();
  });

  it('joins an existing query string', () => {
    expect(buildSnippets(input({ action: 'open', homeUrl: 'https://example.com/?lang=pl' })).url).toBe('https://example.com/?lang=pl&ka11y=open');
  });
});
