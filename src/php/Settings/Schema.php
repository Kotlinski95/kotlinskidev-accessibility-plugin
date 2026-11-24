<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

final class Schema {

	public const VERSION = 1;

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
		'adhdFriendly'   => array( 'readingMask', 'readingLine', 'stopAnimations', 'highlightTitles' ),
		'blindness'      => array( 'keyboardNavigation', 'readPage', 'skipToContent', 'highlightTitles' ),
		'epilepsySafe'   => array( 'stopAnimations', 'muteSounds', 'monochrome' ),
	);

	private const DEVICES = array( 'desktop', 'tablet', 'mobile' );

	private const POSITIONS = array( 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'middle-right', 'middle-left' );

	/**
	 * Memoised definitions.
	 *
	 * @var array<string, array<string, mixed>>|null
	 */
	private static ?array $definitions = null;

	/**
	 * Flat map of dotted path to definition.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function definitions(): array {
		if ( null === self::$definitions ) {
			self::$definitions = self::build();
		}

		return self::$definitions;
	}

	/**
	 * Definition for a dotted path.
	 *
	 * @param string $path Dotted path.
	 * @return array<string, mixed>|null
	 */
	public static function definition( string $path ): ?array {
		return self::definitions()[ $path ] ?? null;
	}

	/**
	 * Visit every definition in declaration order.
	 *
	 * @param callable(string, array<string, mixed>): void $visitor Visitor.
	 */
	public static function walk( callable $visitor ): void {
		foreach ( self::definitions() as $path => $definition ) {
			$visitor( $path, $definition );
		}
	}

	/**
	 * Nested default option tree.
	 *
	 * @return array<string, mixed>
	 */
	public static function defaults(): array {
		$tree = array();

		foreach ( self::definitions() as $path => $definition ) {
			self::assign( $tree, $path, $definition['default'] );
		}

		return $tree;
	}

	/**
	 * Feature keys.
	 *
	 * @return list<string>
	 */
	public static function feature_keys(): array {
		return self::FEATURE_KEYS;
	}

	/**
	 * Profile keys.
	 *
	 * @return list<string>
	 */
	public static function profile_keys(): array {
		return array_keys( self::PROFILE_PRESETS );
	}

	/**
	 * Write a value into a nested array by dotted path.
	 *
	 * @param array<string, mixed> $tree  Target tree.
	 * @param string               $path  Dotted path.
	 * @param mixed                $value Value.
	 */
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

	/**
	 * Read a value from a nested array by dotted path.
	 *
	 * @param array<string, mixed> $tree Source tree.
	 * @param string               $path Dotted path.
	 * @param bool                 $found Set to whether the path exists.
	 */
	public static function read( array $tree, string $path, ?bool &$found = null ): mixed {
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

	/**
	 * Build definitions.
	 *
	 * @return array<string, array<string, mixed>>
	 */
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

		$defs['widget.size']       = self::def( 'string', 'enum', 'md', array( 'enum' => array( 'sm', 'md', 'lg' ) ) );
		$defs['widget.icon']       = self::def( 'string', 'icon', 'universal' );
		$defs['widget.iconBorder'] = self::def( 'boolean', 'bool', false );

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

		$defs['theme.mode']                     = self::def( 'string', 'enum', 'auto', array( 'enum' => array( 'auto', 'light', 'dark' ) ) );
		$defs['theme.darkSelector']             = self::def( 'string', 'text', 'html.dark-mode, body.dark-mode' );
		$defs['theme.lightSelector']            = self::def( 'string', 'text', 'html.light-mode, body.light-mode' );
		$defs['theme.followPrefersColorScheme'] = self::def( 'boolean', 'bool', true );

		$defs['tokens.primary']      = self::def( 'string', 'color', '#0b57d0' );
		$defs['tokens.onPrimary']    = self::def( 'string', 'color', '#ffffff' );
		$defs['tokens.surfaceLight'] = self::def( 'string', 'color', '#ffffff' );
		$defs['tokens.surfaceDark']  = self::def( 'string', 'color', '#1b1b1f' );
		$defs['tokens.textLight']    = self::def( 'string', 'color', '#1b1b1f' );
		$defs['tokens.textDark']     = self::def( 'string', 'color', '#f2f2f2' );
		$defs['tokens.radius']       = self::def( 'string', 'length', '12px' );
		$defs['tokens.zIndex']       = self::def(
			'integer',
			'int',
			2147483000,
			array(
				'min' => 0,
				'max' => 2147483647,
			)
		);
		$defs['tokens.fontFamily']   = self::def( 'string', 'text', 'inherit', array( 'required' => true ) );

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

		$defs['labels'] = self::def( 'object', 'label_map', array() );

		$defs['advanced.excludeSelectors'] = self::def( 'string', 'text', '#wpadminbar' );
		$defs['advanced.loadStrategy']     = self::def( 'string', 'enum', 'defer', array( 'enum' => array( 'defer', 'idle' ) ) );

		return $defs;
	}

	/**
	 * Build one definition.
	 *
	 * @param string               $type     Structural type.
	 * @param string               $sanitize Sanitizer strategy.
	 * @param mixed                $fallback  Default value.
	 * @param array<string, mixed> $extra    Constraints.
	 * @return array<string, mixed>
	 */
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
