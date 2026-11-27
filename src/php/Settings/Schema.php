<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

use Kotlinskidev\A11y\Frontend\Actions;

final class Schema {

	public const VERSION = 5;

	public const PANEL_TOKENS = array( 'primaryDark', 'onPrimaryDark', 'headerBg', 'onHeader', 'canvasLight', 'canvasDark' );

	public const PANEL_SECTIONS = array( 'profiles', 'content', 'color', 'orientation', 'skip' );

	public const PANEL_PRESETS = array( 'classic', 'brand', 'soft', 'contrast', 'custom' );

	private const FEATURE_KEYS = array(
		'biggerText',
		'lineHeight',
		'letterSpacing',
		'fontWeight',
		'readableFont',
		'dyslexicFont',
		'textAlign',
		'highlightLinks',
		'bigCursor',
		'textMagnifier',
		'cognitiveReading',
		'darkContrast',
		'lightContrast',
		'highContrast',
		'monochrome',
		'saturation',
		'readingLine',
		'readingMask',
		'readPage',
		'keyboardNavigation',
		'hideImages',
		'muteSounds',
		'highlightTitles',
		'highlightAll',
		'stopAnimations',
		'skipToContent',
	);

	private const PROFILE_PRESETS = array(
		'visionImpaired' => array( 'biggerText', 'highContrast', 'readableFont', 'highlightLinks', 'bigCursor' ),
		'seizureSafe'    => array( 'stopAnimations', 'muteSounds', 'saturation' ),
		'adhdFriendly'   => array( 'readingMask', 'stopAnimations', 'highlightTitles', 'muteSounds' ),
		'blindness'      => array( 'keyboardNavigation', 'readPage', 'highlightAll', 'skipToContent' ),
		'epilepsySafe'   => array( 'stopAnimations', 'muteSounds', 'monochrome' ),
	);

	private const PERFORMANCE_PRESET_KEYS = array( 'strategy', 'position', 'fetchPriority', 'prefetch', 'pageCss', 'deviceSkip', 'optOut' );

	private const OPT_OUTS = array( 'cloudflare', 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup' );

	private const PERFORMANCE_PRESETS = array(
		'recommended'   => array(
			'strategy'      => 'interaction',
			'position'      => 'footer',
			'fetchPriority' => 'low',
			'prefetch'      => 'hover',
			'pageCss'       => 'lazy',
			'deviceSkip'    => true,
			'optOut'        => array(),
		),
		'compatibility' => array(
			'strategy'      => 'eager',
			'position'      => 'footer',
			'fetchPriority' => 'auto',
			'prefetch'      => 'none',
			'pageCss'       => 'linked',
			'deviceSkip'    => false,
			'optOut'        => array( 'cloudflare', 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup' ),
		),
	);

	private const DEVICES = array( 'desktop', 'tablet', 'mobile' );

	public const SIZE_REM_MIN = 1.5;

	public const SIZE_REM_MAX = 5;

	public const READ_RATE_MIN = 0.5;

	public const READ_RATE_MAX = 2;

	private const LAUNCHERS = array( 'floating', 'inline', 'hidden' );

	private const POSITIONS = array( 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'middle-right', 'middle-left' );

	public const LEGACY_DARK_SELECTOR = 'html.dark-mode, body.dark-mode';

	public const LEGACY_LIGHT_SELECTOR = 'html.light-mode, body.light-mode';

	public const DEFAULT_DARK_SELECTOR = 'html.dark, html.dark-mode, html[data-theme="dark"], body.dark, body.dark-mode';

	public const DEFAULT_LIGHT_SELECTOR = 'html.light, html.light-mode, html[data-theme="light"], body.light, body.light-mode';

	private static ?array $definitions = null;

	private static ?array $base = null;

	private static ?array $applied_selectors = null;

	public static function definitions(): array {
		if ( null === self::$base ) {
			self::$base = self::build();
		}

		$selectors = self::default_selectors();

		if ( null === self::$definitions || $selectors !== self::$applied_selectors ) {
			self::$definitions                                   = self::$base;
			self::$definitions['theme.darkSelector']['default']  = $selectors['darkSelector'];
			self::$definitions['theme.lightSelector']['default'] = $selectors['lightSelector'];
			self::$applied_selectors                             = $selectors;
		}

		return self::$definitions;
	}

	public static function default_selectors(): array {
		$filtered = apply_filters(
			'kotlinskidev_a11y_default_selectors',
			array(
				'darkSelector'  => self::DEFAULT_DARK_SELECTOR,
				'lightSelector' => self::DEFAULT_LIGHT_SELECTOR,
			)
		);
		$filtered = is_array( $filtered ) ? $filtered : array();

		return array(
			'darkSelector'  => self::selector_or( $filtered['darkSelector'] ?? null, self::DEFAULT_DARK_SELECTOR ),
			'lightSelector' => self::selector_or( $filtered['lightSelector'] ?? null, self::DEFAULT_LIGHT_SELECTOR ),
		);
	}

	private static function selector_or( mixed $value, string $fallback ): string {
		if ( ! is_string( $value ) ) {
			return $fallback;
		}

		$clean = trim( (string) preg_replace( '/[<>{};]/', '', $value ) );

		return '' === $clean ? $fallback : $clean;
	}

	public static function definition( string $path ): ?array {
		return self::definitions()[ $path ] ?? null;
	}

	public static function walk( callable $visitor ): void {
		foreach ( self::definitions() as $path => $definition ) {
			$visitor( $path, $definition );
		}
	}

	public static function defaults(): array {
		$tree = array();

		foreach ( self::definitions() as $path => $definition ) {
			self::assign( $tree, $path, $definition['default'] );
		}

		return $tree;
	}

	public static function feature_keys(): array {
		return self::FEATURE_KEYS;
	}

	public static function profile_keys(): array {
		return array_keys( self::PROFILE_PRESETS );
	}

	public static function performance_presets(): array {
		return self::PERFORMANCE_PRESETS;
	}

	public static function apply_performance_preset( array $tree ): array {
		$preset = $tree['performance']['preset'] ?? null;

		if ( ! is_string( $preset ) || ! isset( self::PERFORMANCE_PRESETS[ $preset ] ) ) {
			return $tree;
		}

		foreach ( self::PERFORMANCE_PRESET_KEYS as $key ) {
			$tree['performance'][ $key ] = self::PERFORMANCE_PRESETS[ $preset ][ $key ];
		}

		return $tree;
	}

	public static function assign( array &$tree, string $path, mixed $value ): void {
		$segments = explode( '.', $path );
		$last     = array_pop( $segments );
		$cursor   = &$tree;

		foreach ( $segments as $segment ) {
			if ( ! isset( $cursor[ $segment ] ) || ! is_array( $cursor[ $segment ] ) ) {
				$cursor[ $segment ] = array();
			}
			$cursor = &$cursor[ $segment ];
		}

		$cursor[ $last ] = $value;
	}

	public static function remove( array &$tree, string $path ): void {
		self::remove_segments( $tree, explode( '.', $path ) );
	}

	public static function is_under( string $path, string $prefix ): bool {
		return $path === $prefix || str_starts_with( $path, $prefix . '.' );
	}

	public static function is_known_prefix( string $candidate ): bool {
		foreach ( array_keys( self::definitions() ) as $path ) {
			if ( self::is_under( $path, $candidate ) ) {
				return true;
			}
		}

		return false;
	}

	public static function read( array $tree, string $path, bool &$found = false ): mixed {
		$cursor = $tree;

		foreach ( explode( '.', $path ) as $segment ) {
			if ( ! is_array( $cursor ) || ! array_key_exists( $segment, $cursor ) ) {
				$found = false;
				return null;
			}
			$cursor = $cursor[ $segment ];
		}

		$found = true;
		return $cursor;
	}

	private static function remove_segments( array &$node, array $segments ): void {
		$head = (string) array_shift( $segments );

		if ( ! array_key_exists( $head, $node ) ) {
			return;
		}

		if ( array() === $segments ) {
			unset( $node[ $head ] );
			return;
		}

		if ( ! is_array( $node[ $head ] ) ) {
			return;
		}

		self::remove_segments( $node[ $head ], $segments );

		if ( array() === $node[ $head ] ) {
			unset( $node[ $head ] );
		}
	}

	private static function build(): array {
		$defs = array(
			'schemaVersion' => self::def(
				'integer',
				'int',
				self::VERSION,
				array(
					'min' => 1,
					'max' => 1000,
				)
			),
		);

		foreach ( self::FEATURE_KEYS as $key ) {
			$defs[ "features.$key.enabled" ] = self::def( 'boolean', 'bool', true );
			$defs[ "features.$key.default" ] = self::def(
				'integer',
				'level',
				false,
				array(
					'min' => 0,
					'max' => 10,
				)
			);
		}

		foreach ( self::PROFILE_PRESETS as $key => $preset ) {
			$defs[ "profiles.$key.enabled" ]  = self::def( 'boolean', 'bool', true );
			$defs[ "profiles.$key.features" ] = self::def( 'array', 'enum_list', $preset, array( 'enum' => self::FEATURE_KEYS ) );
		}

		foreach ( self::DEVICES as $device ) {
			$defs[ "widget.position.$device" ] = self::def( 'string', 'enum', 'bottom-right', array( 'enum' => self::POSITIONS ) );
			$defs[ "widget.offsetX.$device" ]  = self::def(
				'integer',
				'int',
				20,
				array(
					'min' => 0,
					'max' => 500,
				)
			);
			$defs[ "widget.offsetY.$device" ]  = self::def(
				'integer',
				'int',
				20,
				array(
					'min' => 0,
					'max' => 500,
				)
			);
		}

		foreach ( self::DEVICES as $device ) {
			$defs[ "widget.sizes.$device" ] = self::def( 'string', 'enum', 'inherit', array( 'enum' => array( 'inherit', 'sm', 'md', 'lg' ) ) );
		}

		foreach ( self::DEVICES as $device ) {
			$defs[ "widget.sizesRem.$device" ] = self::def(
				'number',
				'decimal',
				'',
				array(
					'min'      => self::SIZE_REM_MIN,
					'max'      => self::SIZE_REM_MAX,
					'nullable' => true,
				)
			);
		}

		$defs['widget.sizeRem']    = self::def(
			'number',
			'decimal',
			'',
			array(
				'min'      => self::SIZE_REM_MIN,
				'max'      => self::SIZE_REM_MAX,
				'nullable' => true,
			)
		);
		$defs['widget.size']       = self::def( 'string', 'enum', 'md', array( 'enum' => array( 'sm', 'md', 'lg' ) ) );
		$defs['widget.shape']      = self::def( 'string', 'enum', 'circle', array( 'enum' => array( 'circle', 'rounded', 'square' ) ) );
		$defs['widget.bg']         = self::def( 'string', 'color', '' );
		$defs['widget.fg']         = self::def( 'string', 'color', '' );
		$defs['widget.bgDark']     = self::def( 'string', 'color', '' );
		$defs['widget.fgDark']     = self::def( 'string', 'color', '' );
		$defs['widget.icon']       = self::def( 'string', 'icon', 'universal' );
		$defs['widget.iconBorder'] = self::def( 'boolean', 'bool', false );
		$defs['widget.launcher']   = self::def( 'string', 'enum', 'floating', array( 'enum' => self::LAUNCHERS ) );
		$defs['widget.mount']      = self::def( 'string', 'selector', '' );

		foreach ( self::DEVICES as $device ) {
			$defs[ "visibility.devices.$device" ] = self::def( 'boolean', 'bool', true );
		}

		$defs['visibility.breakpoints.tablet'] = self::def(
			'integer',
			'int',
			1024,
			array(
				'min' => 320,
				'max' => 4096,
			)
		);
		$defs['visibility.breakpoints.mobile'] = self::def(
			'integer',
			'int',
			768,
			array(
				'min' => 320,
				'max' => 4096,
			)
		);
		$defs['visibility.excludePostIds']     = self::def(
			'array',
			'int_list',
			array(),
			array(
				'min' => 1,
				'max' => PHP_INT_MAX,
			)
		);
		$defs['visibility.excludePostTypes']   = self::def( 'array', 'text_list', array() );
		$defs['visibility.excludeRoles']       = self::def( 'array', 'text_list', array() );
		$defs['visibility.excludeUrlPatterns'] = self::def( 'array', 'text_list', array() );
		$defs['visibility.mode']               = self::def( 'string', 'enum', 'everywhere', array( 'enum' => array( 'everywhere', 'only_on', 'except_on' ) ) );
		$defs['visibility.includePostIds']     = self::def(
			'array',
			'int_list',
			array(),
			array(
				'min' => 1,
				'max' => PHP_INT_MAX,
			)
		);
		$defs['visibility.includePostTypes']   = self::def( 'array', 'text_list', array() );
		$defs['visibility.includeTemplates']   = self::def( 'array', 'text_list', array() );
		$defs['visibility.includeRoles']       = self::def( 'array', 'text_list', array() );
		$defs['visibility.includeUrlPatterns'] = self::def( 'array', 'text_list', array() );
		$defs['visibility.excludeTemplates']   = self::def( 'array', 'text_list', array() );

		$defs['theme.mode']                     = self::def( 'string', 'enum', 'auto', array( 'enum' => array( 'auto', 'light', 'dark' ) ) );
		$defs['theme.darkSelector']             = self::def( 'string', 'text', self::DEFAULT_DARK_SELECTOR );
		$defs['theme.lightSelector']            = self::def( 'string', 'text', self::DEFAULT_LIGHT_SELECTOR );
		$defs['theme.followPrefersColorScheme'] = self::def( 'boolean', 'bool', true );

		$defs['tokens.primary']       = self::def( 'string', 'color', '#0b57d0' );
		$defs['tokens.onPrimary']     = self::def( 'string', 'color', '#ffffff' );
		$defs['tokens.primaryDark']   = self::def( 'string', 'color', '#7aa7ff' );
		$defs['tokens.onPrimaryDark'] = self::def( 'string', 'color', '#0b1a33' );
		$defs['tokens.headerBg']      = self::def( 'string', 'color', '#16181d' );
		$defs['tokens.onHeader']      = self::def( 'string', 'color', '#ffffff' );
		$defs['tokens.canvasLight']   = self::def( 'string', 'color', '#f2f4f7' );
		$defs['tokens.canvasDark']    = self::def( 'string', 'color', '#101114' );
		$defs['tokens.surfaceLight']  = self::def( 'string', 'color', '#ffffff' );
		$defs['tokens.surfaceDark']   = self::def( 'string', 'color', '#1b1b1f' );
		$defs['tokens.textLight']     = self::def( 'string', 'color', '#1b1b1f' );
		$defs['tokens.textDark']      = self::def( 'string', 'color', '#f2f2f2' );
		$defs['tokens.radius']        = self::def( 'string', 'length', '12px' );
		$defs['tokens.zIndex']        = self::def(
			'integer',
			'int',
			2147483000,
			array(
				'min' => 0,
				'max' => 2147483647,
			)
		);
		$defs['tokens.fontFamily']    = self::def( 'string', 'text', 'inherit', array( 'required' => true ) );

		$defs['panel.columns'] = self::def(
			'integer',
			'int',
			3,
			array(
				'min' => 2,
				'max' => 3,
			)
		);

		foreach ( self::PANEL_SECTIONS as $section ) {
			$defs[ "panel.sections.$section" ] = self::def( 'boolean', 'bool', true );
		}

		$defs['panel.languageSwitcher'] = self::def( 'boolean', 'bool', true );
		$defs['panel.credit']           = self::def( 'boolean', 'bool', true );
		$defs['panel.order']            = self::def( 'array', 'enum_list', self::FEATURE_KEYS, array( 'enum' => self::FEATURE_KEYS ) );
		$defs['panel.preset']           = self::def( 'string', 'enum', 'classic', array( 'enum' => self::PANEL_PRESETS ) );
		$defs['panel.languageMode']     = self::def( 'string', 'enum', 'choose', array( 'enum' => array( 'follow', 'choose' ) ) );
		$defs['panel.backdrop']         = self::def( 'boolean', 'bool', false );
		$defs['panel.backdropColor']    = self::def( 'string', 'color', '#000000' );
		$defs['panel.backdropOpacity']  = self::def(
			'integer',
			'int',
			40,
			array(
				'min' => 0,
				'max' => 100,
			)
		);
		$defs['panel.backdropBlur']     = self::def(
			'integer',
			'int',
			0,
			array(
				'min' => 0,
				'max' => 20,
			)
		);
		$defs['panel.closeOnBackdrop']  = self::def( 'boolean', 'bool', true );
		$defs['panel.animation']        = self::def( 'string', 'enum', 'slide', array( 'enum' => array( 'slide', 'fade', 'none' ) ) );
		$defs['panel.animationMs']      = self::def(
			'integer',
			'int',
			220,
			array(
				'min' => 0,
				'max' => 1000,
			)
		);
		$defs['panel.width']            = self::def(
			'integer',
			'int',
			448,
			array(
				'min' => 280,
				'max' => 640,
			)
		);
		$defs['panel.side']             = self::def( 'string', 'enum', 'auto', array( 'enum' => array( 'auto', 'left', 'right' ) ) );
		$defs['panel.offset']           = self::def(
			'integer',
			'int',
			0,
			array(
				'min' => 0,
				'max' => 200,
			)
		);

		$defs['readPage.voice'] = self::def( 'string', 'text', '' );
		$defs['readPage.rate']  = self::def(
			'number',
			'decimal',
			1,
			array(
				'min' => self::READ_RATE_MIN,
				'max' => self::READ_RATE_MAX,
			)
		);

		$defs['customCss'] = self::def( 'string', 'css', '' );

		$defs['storage.mode']    = self::def( 'string', 'enum', 'local', array( 'enum' => array( 'local', 'cookie', 'none' ) ) );
		$defs['storage.ttlDays'] = self::def(
			'integer',
			'int',
			365,
			array(
				'min' => 1,
				'max' => 3650,
			)
		);
		$defs['storage.key']     = self::def( 'string', 'key', 'ka11y', array( 'required' => true ) );

		$defs['statement.pageId']  = self::def(
			'integer',
			'int',
			0,
			array(
				'min' => 0,
				'max' => PHP_INT_MAX,
			)
		);
		$defs['statement.url']     = self::def( 'string', 'url', '' );
		$defs['statement.content'] = self::def( 'object', 'html_map', array() );

		$defs['shortcut.enabled'] = self::def( 'boolean', 'bool', true );
		$defs['shortcut.combo']   = self::def( 'string', 'combo', 'Alt+Shift+A', array( 'required' => true ) );

		$defs['hideToolbar.allow'] = self::def( 'boolean', 'bool', true );
		$defs['hideToolbar.days']  = self::def(
			'array',
			'int_list',
			array( 1, 7, 30 ),
			array(
				'min' => 1,
				'max' => 3650,
			)
		);

		$defs['triggers.selectors']  = self::def( 'array', 'selector_list', array(), array( 'max' => 10 ) );
		$defs['triggers.urlActions'] = self::def( 'array', 'enum_list', Actions::URL, array( 'enum' => Actions::URL ) );

		$defs['labels'] = self::def( 'object', 'label_map', array() );

		$defs['advanced.excludeSelectors'] = self::def( 'string', 'text', '#wpadminbar' );

		$defs['performance.preset']        = self::def( 'string', 'enum', 'recommended', array( 'enum' => array( 'recommended', 'compatibility', 'custom' ) ) );
		$defs['performance.strategy']      = self::def( 'string', 'enum', 'interaction', array( 'enum' => array( 'interaction', 'idle', 'defer', 'async', 'eager' ) ) );
		$defs['performance.position']      = self::def( 'string', 'enum', 'footer', array( 'enum' => array( 'head', 'footer' ) ) );
		$defs['performance.fetchPriority'] = self::def( 'string', 'enum', 'low', array( 'enum' => array( 'low', 'auto', 'high' ) ) );
		$defs['performance.prefetch']      = self::def( 'string', 'enum', 'hover', array( 'enum' => array( 'none', 'hover', 'idle' ) ) );
		$defs['performance.pageCss']       = self::def( 'string', 'enum', 'lazy', array( 'enum' => array( 'lazy', 'linked', 'inline' ) ) );
		$defs['performance.deviceSkip']    = self::def( 'boolean', 'bool', true );
		$defs['performance.optOut']        = self::def( 'array', 'enum_list', array(), array( 'enum' => self::OPT_OUTS ) );

		$defs['maintenance.keepDataOnUninstall'] = self::def( 'boolean', 'bool', false );

		return $defs;
	}

	private static function def( string $type, string $sanitize, mixed $fallback, array $extra = array() ): array {
		return array_merge(
			array(
				'type'     => $type,
				'default'  => $fallback,
				'sanitize' => $sanitize,
			),
			$extra
		);
	}
}
