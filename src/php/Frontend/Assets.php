<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Repository;

final class Assets {

	private const SCRIPT_HANDLE = 'kotlinskidev-a11y-frontend';
	private const STYLE_HANDLE  = 'kotlinskidev-a11y-frontend';
	private const TOKENS_HANDLE = 'kotlinskidev-a11y-tokens';
	private const JSON_FLAGS    = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS;
	private const SIZES         = array(
		'sm' => 40,
		'md' => 52,
		'lg' => 64,
	);
	private const DEVICES       = array( 'desktop', 'tablet', 'mobile' );

	private Visibility $visibility;
	private Repository $repository;
	private Strings $strings;
	private LanguageResolver $resolver;

	public function __construct(
		?Visibility $visibility = null,
		?Repository $repository = null,
		?Strings $strings = null,
		?LanguageResolver $resolver = null
	) {
		$this->repository = $repository ?? new Repository();
		$this->visibility = $visibility ?? new Visibility( $this->repository );
		$this->strings    = $strings ?? new Strings( $this->repository );
		$this->resolver   = $resolver ?? new LanguageResolver();
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
	}

	public function enqueue(): void {
		if ( ! $this->visibility->should_render() ) {
			return;
		}

		$settings = $this->repository->get();
		$idle     = 'idle' === ( $settings['advanced']['loadStrategy'] ?? 'defer' );
		$version  = $this->asset_version( 'frontend' );
		$source   = KOTLINSKIDEV_A11Y_URL . 'build/frontend.js';

		wp_enqueue_style(
			self::STYLE_HANDLE,
			KOTLINSKIDEV_A11Y_URL . 'build/frontend.css',
			array(),
			$version
		);

		if ( $idle ) {
			wp_register_script( self::SCRIPT_HANDLE, false, array(), $version, array( 'in_footer' => true ) );
		} else {
			wp_register_script(
				self::SCRIPT_HANDLE,
				$source,
				array(),
				$version,
				array(
					'in_footer' => true,
					'strategy'  => 'defer',
				)
			);
		}

		wp_enqueue_script( self::SCRIPT_HANDLE );
		wp_add_inline_script( self::SCRIPT_HANDLE, $this->config_script( $settings ), 'before' );

		if ( $idle ) {
			wp_add_inline_script( self::SCRIPT_HANDLE, $this->idle_loader( add_query_arg( 'ver', $version, $source ) ) );
		}
	}

	public function config( array $settings ): array {
		$locale = $this->resolver->current_locale();

		return array(
			'v'            => KOTLINSKIDEV_A11Y_VERSION,
			'features'     => $settings['features'] ?? array(),
			'profiles'     => $settings['profiles'] ?? array(),
			'widget'       => $settings['widget'] ?? array(),
			'theme'        => $settings['theme'] ?? array(),
			'tokens'       => $settings['tokens'] ?? array(),
			'storage'      => $settings['storage'] ?? array(),
			'shortcut'     => $settings['shortcut'] ?? array(),
			'hideToolbar'  => $settings['hideToolbar'] ?? array(),
			'statementUrl' => $this->statement_url( $settings ),
			'strings'      => $this->strings->for_locale( $locale ),
			'locale'       => $locale,
			'rtl'          => $this->resolver->is_rtl_locale( $locale ),
			'customCss'    => (string) ( $settings['customCss'] ?? '' ),
			'advanced'     => array(
				'excludeSelectors' => (string) ( $settings['advanced']['excludeSelectors'] ?? '' ),
			),
			'assets'       => array(
				'dyslexicFontUrl' => KOTLINSKIDEV_A11Y_URL . 'assets/fonts/opendyslexic-regular.woff2',
			),
		);
	}

	public function config_script( array $settings ): string {
		return 'window.kotlinskidevA11y = ' . wp_json_encode( $this->config( $settings ), self::JSON_FLAGS ) . ';';
	}

	public function tokens_css( array $settings ): string {
		$css  = $this->root_variables( $settings );
		$css .= $this->device_rules( $settings );

		return str_replace( '<', '', $css );
	}

	private function bootstrap_script( array $settings ): string {
		$storage = wp_json_encode( $settings['storage'] ?? array(), self::JSON_FLAGS );
		$code    = $this->read_build_file( 'bootstrap.js' );

		return 'window.kotlinskidevA11y={storage:' . $storage . '};' . str_ireplace( '</script', '<\/script', $code );
	}

	private function read_build_file( string $file ): string {
		$path = KOTLINSKIDEV_A11Y_DIR . 'build/' . $file;

		if ( ! is_readable( $path ) ) {
			return '';
		}

		return implode( '', (array) file( $path ) );
	}

	private function asset_version( string $name ): string {
		$path = KOTLINSKIDEV_A11Y_DIR . 'build/' . $name . '.asset.php';

		if ( is_readable( $path ) ) {
			$asset = include $path;

			if ( is_array( $asset ) && isset( $asset['version'] ) ) {
				return (string) $asset['version'];
			}
		}

		return KOTLINSKIDEV_A11Y_VERSION;
	}

	private function idle_loader( string $url ): string {
		$encoded = wp_json_encode( $url, self::JSON_FLAGS );

		return '(function(){var load=function(){var s=document.createElement("script");s.src=' . $encoded . ';s.defer=true;document.head.appendChild(s);};'
			. 'if("requestIdleCallback" in window){window.requestIdleCallback(load,{timeout:3000});}else{window.setTimeout(load,1);}})();';
	}

	private function statement_url( array $settings ): string {
		$statement = $settings['statement'] ?? array();
		$page_id   = (int) ( $statement['pageId'] ?? 0 );

		if ( $page_id > 0 ) {
			$permalink = get_permalink( $page_id );

			if ( is_string( $permalink ) && '' !== $permalink ) {
				return $permalink;
			}
		}

		return (string) ( $statement['url'] ?? '' );
	}

	private function root_variables( array $settings ): string {
		$tokens = $settings['tokens'] ?? array();
		$size   = (string) ( $settings['widget']['size'] ?? 'md' );
		$rules  = array();

		foreach ( $tokens as $name => $value ) {
			$rules[] = '--ka11y-' . $this->kebab( (string) $name ) . ':' . $this->css_value( (string) $value );
		}

		$rules[] = '--ka11y-size:' . ( self::SIZES[ $size ] ?? self::SIZES['md'] ) . 'px';

		return ':root{' . implode( ';', $rules ) . '}';
	}

	private function device_rules( array $settings ): string {
		$widget      = $settings['widget'] ?? array();
		$visibility  = $settings['visibility'] ?? array();
		$breakpoints = $visibility['breakpoints'] ?? array();
		$tablet      = (int) ( $breakpoints['tablet'] ?? 1024 );
		$mobile      = (int) ( $breakpoints['mobile'] ?? 768 );
		$queries     = array(
			'desktop' => '(min-width:' . ( $tablet + 1 ) . 'px)',
			'tablet'  => '(min-width:' . ( $mobile + 1 ) . 'px) and (max-width:' . $tablet . 'px)',
			'mobile'  => '(max-width:' . $mobile . 'px)',
		);
		$css         = '';

		foreach ( self::DEVICES as $device ) {
			$declarations = $this->placement(
				(string) ( $widget['position'][ $device ] ?? 'bottom-right' ),
				(int) ( $widget['offsetX'][ $device ] ?? 20 ),
				(int) ( $widget['offsetY'][ $device ] ?? 20 )
			);

			if ( false === ( $visibility['devices'][ $device ] ?? true ) ) {
				$declarations .= 'display:none!important;';
			}

			$css .= '@media ' . $queries[ $device ] . '{#ka11y-root{' . $declarations . '}}';
		}

		return $css;
	}

	private function placement( string $position, int $offset_x, int $offset_y ): string {
		$parts      = explode( '-', $position );
		$vertical   = $parts[0];
		$horizontal = $parts[1] ?? 'right';
		$css        = $horizontal . ':' . $offset_x . 'px;' . ( 'left' === $horizontal ? 'right' : 'left' ) . ':auto;';

		if ( 'middle' === $vertical ) {
			return $css . 'top:50%;bottom:auto;transform:translateY(-50%);';
		}

		return $css . $vertical . ':' . $offset_y . 'px;' . ( 'top' === $vertical ? 'bottom' : 'top' ) . ':auto;transform:none;';
	}

	private function kebab( string $name ): string {
		return strtolower( (string) preg_replace( '/([a-z0-9])([A-Z])/', '$1-$2', $name ) );
	}

	private function css_value( string $value ): string {
		return trim( (string) preg_replace( '/[<>{};]/', '', $value ) );
	}
}
