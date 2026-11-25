<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Frontend\InlineConfig;
use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Frontend\PanelData;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Rest\SettingsController;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Support\Json;

final class SettingsPage {

	public const SLUG          = 'kotlinskidev-accessibility';
	public const SCRIPT_HANDLE = 'kotlinskidev-a11y-admin';
	public const STYLE_HANDLE  = 'kotlinskidev-a11y-admin';
	public const TEXT_DOMAIN   = 'kotlinskidev-accessibility';
	public const MOUNT_ID      = 'kotlinskidev-a11y-admin';
	private const JSON_FLAGS   = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS;

	private Strings $strings;
	private Access $access;
	private string|false $hook_suffix = false;

	public function __construct( ?Strings $strings = null, ?Access $access = null ) {
		$this->strings = $strings ?? new Strings();
		$this->access  = $access ?? new Access();
	}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( KOTLINSKIDEV_A11Y_DIR . 'kotlinskidev-accessibility.php' ), array( $this, 'action_links' ) );
	}

	public function capability(): string {
		return $this->access->admin_capability();
	}

	public function add_menu(): void {
		$this->hook_suffix = add_options_page(
			__( 'Accessibility', 'kotlinskidev-accessibility' ),
			__( 'Accessibility', 'kotlinskidev-accessibility' ),
			$this->access->menu_capability(),
			self::SLUG,
			array( $this, 'render' )
		);
	}

	public function action_links( array $links ): array {
		$settings = sprintf(
			'<a href="%1$s">%2$s</a>',
			esc_url( admin_url( 'options-general.php?page=' . self::SLUG ) ),
			esc_html__( 'Settings', 'kotlinskidev-accessibility' )
		);

		return array_merge( array( 'settings' => $settings ), $links );
	}

	public function render(): void {
		if ( Access::NONE === $this->access->level() ) {
			return;
		}

		printf(
			'<div class="wrap ka11y-admin-wrap"><h1 class="wp-heading-inline">%1$s</h1><div id="%2$s" class="ka11y-admin"><noscript><p>%3$s</p></noscript></div></div>',
			esc_html__( 'Accessibility', 'kotlinskidev-accessibility' ),
			esc_attr( self::MOUNT_ID ),
			esc_html__( 'This settings page needs JavaScript.', 'kotlinskidev-accessibility' )
		);
	}

	public function enqueue( string $hook ): void {
		if ( false === $this->hook_suffix || $hook !== $this->hook_suffix ) {
			return;
		}

		$asset = $this->asset( 'admin' );

		wp_enqueue_style( self::STYLE_HANDLE, KOTLINSKIDEV_A11Y_URL . 'build/admin.css', array(), $asset['version'] );
		wp_enqueue_media();
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			KOTLINSKIDEV_A11Y_URL . 'build/admin.js',
			$asset['dependencies'],
			$asset['version'],
			array( 'in_footer' => true )
		);
		wp_set_script_translations( self::SCRIPT_HANDLE, self::TEXT_DOMAIN, KOTLINSKIDEV_A11Y_DIR . 'languages' );
		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.kotlinskidevA11yAdmin = ' . Json::encode( $this->config(), self::JSON_FLAGS ) . ';',
			'before'
		);
	}

	public function config(): array {
		return array(
			'restRoot' => esc_url_raw( rest_url( SettingsController::REST_NAMESPACE . '/' ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'strings'  => $this->strings->defaults(),
			'locales'  => $this->locales(),
			'profiles' => Schema::profile_keys(),
			'features' => Schema::feature_keys(),
			'version'  => KOTLINSKIDEV_A11Y_VERSION,
			'homeUrl'  => esc_url_raw( home_url( '/' ) ),
			'cost'     => $this->cost(),
		);
	}

	public function cost(): array {
		$repository = new Repository();
		$panel_data = new PanelData( $repository, $this->strings );

		return array(
			'manifest'  => Manifest::data(),
			'panelData' => $this->compressed_size( $panel_data->encode( $panel_data->payload( get_locale() ) ) ),
			'config'    => $this->compressed_size( ( new InlineConfig( $repository, null, null, $panel_data ) )->script( $repository->get() ) ),
		);
	}

	private function compressed_size( string $body ): int {
		if ( function_exists( 'gzencode' ) ) {
			$compressed = gzencode( $body );

			if ( is_string( $compressed ) ) {
				return strlen( $compressed );
			}
		}

		return (int) round( strlen( $body ) / 3 );
	}

	public function locales(): array {
		$locales = $this->polylang_locales() ?? $this->wpml_locales() ?? $this->translatepress_locales();

		if ( null === $locales || array() === $locales ) {
			$locale  = get_locale();
			$locales = array(
				array(
					'code' => $locale,
					'name' => $locale,
				),
			);
		}

		return $locales;
	}

	private function polylang_locales(): ?array {
		if ( ! function_exists( 'pll_languages_list' ) ) {
			return null;
		}

		$codes = (array) pll_languages_list( array( 'fields' => 'locale' ) );
		$names = (array) pll_languages_list( array( 'fields' => 'name' ) );
		$items = array();

		foreach ( array_values( $codes ) as $index => $code ) {
			$items[] = array(
				'code' => (string) $code,
				'name' => (string) ( array_values( $names )[ $index ] ?? $code ),
			);
		}

		return $items;
	}

	private function wpml_locales(): ?array {
		$languages = apply_filters( 'wpml_active_languages', null );

		if ( ! is_array( $languages ) || array() === $languages ) {
			return null;
		}

		$items = array();

		foreach ( $languages as $code => $language ) {
			$locale  = (string) ( $language['default_locale'] ?? str_replace( '-', '_', (string) $code ) );
			$items[] = array(
				'code' => $locale,
				'name' => (string) ( $language['native_name'] ?? $locale ),
			);
		}

		return $items;
	}

	private function translatepress_locales(): ?array {
		$settings  = get_option( 'trp_settings', array() );
		$languages = is_array( $settings ) ? ( $settings['translation-languages'] ?? array() ) : array();

		if ( ! is_array( $languages ) || array() === $languages ) {
			return null;
		}

		return array_map(
			static fn ( $code ): array => array(
				'code' => (string) $code,
				'name' => (string) $code,
			),
			array_values( $languages )
		);
	}

	private function asset( string $name ): array {
		$path = KOTLINSKIDEV_A11Y_DIR . 'build/' . $name . '.asset.php';

		if ( is_readable( $path ) ) {
			$asset = include $path;

			if ( is_array( $asset ) ) {
				return array(
					'dependencies' => (array) ( $asset['dependencies'] ?? array() ),
					'version'      => (string) ( $asset['version'] ?? KOTLINSKIDEV_A11Y_VERSION ),
				);
			}
		}

		return array(
			'dependencies' => array( 'wp-i18n', 'wp-api-fetch' ),
			'version'      => KOTLINSKIDEV_A11Y_VERSION,
		);
	}
}
