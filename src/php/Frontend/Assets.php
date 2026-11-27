<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Support\Json;

final class Assets {

	private const LOADER_HANDLE = 'kotlinskidev-a11y-loader';
	private const STYLE_HANDLE  = 'kotlinskidev-a11y-frontend';
	private const TOKENS_HANDLE = 'kotlinskidev-a11y-tokens';
	private const CHUNKS        = array( 'kernel', 'panel', 'content', 'color', 'orientation' );
	private const JSON_FLAGS    = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES;
	private const SIZES         = array(
		'sm' => 40,
		'md' => 52,
		'lg' => 64,
	);
	private const DEVICES       = array( 'desktop', 'tablet', 'mobile' );
	private const SHAPES        = array(
		'rounded' => '28%',
		'square'  => '8px',
	);
	private const HIDDEN_RULE   = 'html[data-ka11y-hidden] #ka11y-root{display:none!important}';
	private const NOSCRIPT      = '<noscript><style>#ka11y-root,.ka11y-trigger{display:none!important}</style></noscript>';

	private Visibility $visibility;
	private Repository $repository;
	private InlineConfig $inline_config;

	public function __construct(
		?Visibility $visibility = null,
		?Repository $repository = null,
		?InlineConfig $inline_config = null
	) {
		$this->repository    = $repository ?? new Repository();
		$this->visibility    = $visibility ?? new Visibility( $this->repository );
		$this->inline_config = $inline_config ?? new InlineConfig( $this->repository );
	}

	public function register(): void {
		add_action( 'wp_head', array( $this, 'print_head' ), 1 );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function print_head(): void {
		if ( ! $this->visibility->should_render() ) {
			return;
		}

		$settings = $this->repository->get();

		wp_print_inline_script_tag( $this->bootstrap_script( $settings ), array( 'id' => 'kotlinskidev-a11y-bootstrap' ) );

		wp_register_style( self::TOKENS_HANDLE, false, array(), KOTLINSKIDEV_A11Y_VERSION );
		wp_enqueue_style( self::TOKENS_HANDLE );
		wp_add_inline_style( self::TOKENS_HANDLE, $this->tokens_css( $settings ) );

		echo wp_kses(
			self::NOSCRIPT,
			array(
				'noscript' => array(),
				'style'    => array(),
			)
		);
	}

	public function enqueue(): void {
		if ( ! $this->visibility->should_render() ) {
			return;
		}

		$settings    = $this->repository->get();
		$performance = $settings['performance'] ?? array();
		$strategy    = (string) ( $performance['strategy'] ?? 'interaction' );

		if ( 'linked' === ( $performance['pageCss'] ?? 'lazy' ) ) {
			$page = Manifest::style( 'page' );

			wp_enqueue_style( self::STYLE_HANDLE, KOTLINSKIDEV_A11Y_URL . 'build/' . $page['file'], array(), $page['ver'] );
		}

		$this->register_script( 'loader', 'async' === $strategy, $performance );
		wp_enqueue_script( self::LOADER_HANDLE );
		wp_add_inline_script( self::LOADER_HANDLE, $this->inline_config->script( $settings ), 'before' );

		if ( 'eager' !== $strategy ) {
			return;
		}

		foreach ( self::CHUNKS as $chunk ) {
			$this->register_script( $chunk, false, $performance );
			wp_enqueue_script( 'kotlinskidev-a11y-' . $chunk );
		}
	}

	public function tokens_css( array $settings ): string {
		$css  = $this->root_variables( $settings );
		$css .= $this->device_rules( $settings );
		$css .= self::HIDDEN_RULE;
		$css .= (string) ( $settings['customCss'] ?? '' );

		if ( 'inline' === ( $settings['performance']['pageCss'] ?? 'lazy' ) ) {
			$css .= $this->read_build_file( Manifest::style( 'page' )['file'] );
		}

		return str_replace( '<', '', $css );
	}

	private function register_script( string $name, bool $async, array $performance ): void {
		$entry    = Manifest::script( $name );
		$args     = array(
			'in_footer' => 'head' !== ( $performance['position'] ?? 'footer' ),
			'strategy'  => $async ? 'async' : 'defer',
		);
		$priority = match ( $performance['fetchPriority'] ?? 'auto' ) {
			'low'   => 'low',
			'high'  => 'high',
			default => 'auto',
		};

		if ( 'auto' !== $priority && ScriptAttributes::supports_native_fetch_priority() ) {
			$args['fetchpriority'] = $priority;
		}

		wp_register_script( 'kotlinskidev-a11y-' . $name, KOTLINSKIDEV_A11Y_URL . 'build/' . $entry['file'], array(), $entry['ver'], $args );
	}

	private function bootstrap_script( array $settings ): string {
		$storage = (array) ( $settings['storage'] ?? array() );
		$css     = 'lazy' === ( $settings['performance']['pageCss'] ?? 'lazy' ) ? $this->page_css_url() : null;
		$boot    = array(
			'storage' => $storage,
			'css'     => $css,
			'hk'      => (string) ( $storage['key'] ?? 'ka11y' ) . '-hidden',
		);
		$custom  = InlineConfig::trigger_selectors( $settings );

		if ( '' !== $custom ) {
			$boot['t'] = $custom;
		}

		$prefix = InlineConfig::GLOBAL_NAME . '=' . Json::encode( $boot, self::JSON_FLAGS ) . ';';

		return $prefix . str_ireplace( '</script', '<\/script', $this->read_build_file( 'bootstrap.js' ) );
	}

	private function page_css_url(): string {
		$page = Manifest::style( 'page' );

		return Manifest::url( $page ) . '?ver=' . $page['ver'];
	}

	private function read_build_file( string $file ): string {
		$path = KOTLINSKIDEV_A11Y_DIR . 'build/' . $file;

		if ( ! is_readable( $path ) ) {
			return '';
		}

		return implode( '', (array) file( $path ) );
	}

	private function root_variables( array $settings ): string {
		$tokens = $settings['tokens'] ?? array();
		$size   = (string) ( $settings['widget']['size'] ?? 'md' );
		$rules  = array();

		foreach ( $tokens as $name => $value ) {
			if ( in_array( (string) $name, Schema::PANEL_TOKENS, true ) ) {
				continue;
			}

			$rules[] = '--ka11y-' . $this->kebab( (string) $name ) . ':' . $this->css_value( (string) $value );
		}

		$rem     = $this->size_value( $settings['widget']['sizeRem'] ?? '', '' );
		$rules[] = '--ka11y-size:' . ( '' !== $rem ? $rem : ( self::SIZES[ $size ] ?? self::SIZES['md'] ) . 'px' );

		if ( '' !== $rem ) {
			$rules[] = '--ka11y-size-min:0px';
		}

		$shape = (string) ( $settings['widget']['shape'] ?? 'circle' );

		if ( isset( self::SHAPES[ $shape ] ) ) {
			$rules[] = '--ka11y-launcher-radius:' . self::SHAPES[ $shape ];
		}

		foreach ( array( 'bg', 'fg' ) as $key ) {
			$color = $this->css_value( (string) ( $settings['widget'][ $key ] ?? '' ) );

			if ( '' !== $color ) {
				$rules[] = '--ka11y-launcher-' . $key . ':' . $color;
			}
		}

		return ':root{' . implode( ';', $rules ) . '}' . $this->dark_launcher_rules( $settings );
	}

	private function dark_launcher_rules( array $settings ): string {
		$mode = (string) ( $settings['theme']['mode'] ?? 'auto' );

		if ( 'light' === $mode ) {
			return '';
		}

		$light = array();
		$dark  = array();

		foreach ( array( 'bg', 'fg' ) as $key ) {
			$dark_color = $this->css_value( (string) ( $settings['widget'][ $key . 'Dark' ] ?? '' ) );

			if ( '' === $dark_color ) {
				continue;
			}

			$light_color = $this->css_value( (string) ( $settings['widget'][ $key ] ?? '' ) );
			$name        = '--ka11y-launcher-' . $key . ':';
			$dark[]      = $name . $dark_color;
			$light[]     = $name . ( '' === $light_color ? 'initial' : $light_color );
		}

		if ( array() === $dark ) {
			return '';
		}

		$dark_block = '{' . implode( ';', $dark ) . '}';

		if ( 'dark' === $mode ) {
			return ':root' . $dark_block;
		}

		$css = '';

		if ( ! empty( $settings['theme']['followPrefersColorScheme'] ) ) {
			$css .= '@media (prefers-color-scheme:dark){:root' . $dark_block . '}';
		}

		$light_selector = $this->css_value( (string) ( $settings['theme']['lightSelector'] ?? '' ) );
		$dark_selector  = $this->css_value( (string) ( $settings['theme']['darkSelector'] ?? '' ) );

		if ( '' !== $light_selector ) {
			$css .= $light_selector . '{' . implode( ';', $light ) . '}';
		}

		if ( '' !== $dark_selector ) {
			$css .= $dark_selector . $dark_block;
		}

		return $css;
	}

	private function device_rules( array $settings ): string {
		$widget  = $settings['widget'] ?? array();
		$queries = InlineConfig::device_queries( $settings );
		$css     = '';

		$global_rem = '' !== $this->size_value( $widget['sizeRem'] ?? '', '' );

		foreach ( self::DEVICES as $device ) {
			$declarations = $this->placement(
				(string) ( $widget['position'][ $device ] ?? 'bottom-right' ),
				(int) ( $widget['offsetX'][ $device ] ?? 20 ),
				(int) ( $widget['offsetY'][ $device ] ?? 20 )
			);

			$triggers = '';
			$sized    = (string) ( $widget['sizes'][ $device ] ?? 'inherit' );
			$rem      = $this->size_value( $widget['sizesRem'][ $device ] ?? '', '' );

			if ( '' !== $rem ) {
				$declarations .= '--ka11y-size:' . $rem . ';--ka11y-size-min:0px;';
			} elseif ( isset( self::SIZES[ $sized ] ) ) {
				$declarations .= '--ka11y-size:' . self::SIZES[ $sized ] . 'px;' . ( $global_rem ? '--ka11y-size-min:2.75rem;' : '' );
			}

			if ( false === ( $settings['visibility']['devices'][ $device ] ?? true ) ) {
				$declarations .= 'display:none!important;';
				$triggers      = '.ka11y-trigger{display:none!important}';
			}

			$css .= '@media ' . $queries[ $device ] . '{#ka11y-root{' . $declarations . '}' . $triggers . '}';
		}

		return $css;
	}

	private function size_value( mixed $rem, string $fallback ): string {
		if ( ( ! is_int( $rem ) && ! is_float( $rem ) ) || $rem < Schema::SIZE_REM_MIN || $rem > Schema::SIZE_REM_MAX ) {
			return $fallback;
		}

		return rtrim( rtrim( number_format( (float) $rem, 2, '.', '' ), '0' ), '.' ) . 'rem';
	}

	private function placement( string $position, int $offset_x, int $offset_y ): string {
		$parts      = explode( '-', $position );
		$vertical   = $parts[0];
		$horizontal = $parts[1] ?? 'right';
		$inset      = 'calc(' . $offset_x . 'px + env(safe-area-inset-' . $horizontal . ',0px))';
		$css        = $horizontal . ':' . $inset . ';' . ( 'left' === $horizontal ? 'right' : 'left' ) . ':auto;';

		if ( 'middle' === $vertical ) {
			return $css . 'top:calc(50% - var(--ka11y-size) / 2);bottom:auto;';
		}

		return $css . $vertical . ':calc(' . $offset_y . 'px + env(safe-area-inset-' . $vertical . ',0px));' . ( 'top' === $vertical ? 'bottom' : 'top' ) . ':auto;';
	}

	private function kebab( string $name ): string {
		return strtolower( (string) preg_replace( '/([a-z0-9])([A-Z])/', '$1-$2', $name ) );
	}

	private function css_value( string $value ): string {
		return trim( (string) preg_replace( '/[<>{};]/', '', $value ) );
	}
}
