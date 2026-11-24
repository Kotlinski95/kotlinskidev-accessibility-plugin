<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Support\Json;

final class InlineConfig {

	public const GLOBAL_NAME = 'window.kotlinskidevA11y';

	private const JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
	private const DEVICES    = array( 'desktop', 'tablet', 'mobile' );
	private const CHUNKS     = array( 'kernel', 'panel', 'content', 'color', 'orientation' );
	private const MODIFIERS  = array(
		'alt'     => 'alt',
		'option'  => 'alt',
		'shift'   => 'shift',
		'ctrl'    => 'ctrl',
		'control' => 'ctrl',
		'meta'    => 'meta',
		'cmd'     => 'meta',
		'command' => 'meta',
	);

	private Repository $repository;
	private LanguageResolver $resolver;
	private PanelDataStore $store;
	private PanelData $panel_data;

	public function __construct(
		?Repository $repository = null,
		?LanguageResolver $resolver = null,
		?PanelDataStore $store = null,
		?PanelData $panel_data = null
	) {
		$this->repository = $repository ?? new Repository();
		$this->resolver   = $resolver ?? new LanguageResolver();
		$this->panel_data = $panel_data ?? new PanelData( $this->repository );
		$this->store      = $store ?? new PanelDataStore( $this->panel_data );
	}

	public static function device_queries( array $settings ): array {
		$breakpoints = $settings['visibility']['breakpoints'] ?? array();
		$tablet      = (int) ( $breakpoints['tablet'] ?? 1024 );
		$mobile      = (int) ( $breakpoints['mobile'] ?? 768 );

		return array(
			'desktop' => '(min-width:' . ( $tablet + 1 ) . 'px)',
			'tablet'  => '(min-width:' . ( $mobile + 1 ) . 'px) and (max-width:' . $tablet . 'px)',
			'mobile'  => '(max-width:' . $mobile . 'px)',
		);
	}

	public static function hidden_media( array $settings ): string {
		$queries = self::device_queries( $settings );
		$hidden  = array();

		foreach ( self::DEVICES as $device ) {
			if ( false === ( $settings['visibility']['devices'][ $device ] ?? true ) ) {
				$hidden[] = $queries[ $device ];
			}
		}

		return implode( ',', $hidden );
	}

	public static function parse_combo( string $combo ): ?array {
		$parsed = array(
			'alt'   => false,
			'shift' => false,
			'ctrl'  => false,
			'meta'  => false,
			'key'   => '',
			'code'  => '',
		);

		foreach ( explode( '+', $combo ) as $raw ) {
			$part = strtolower( trim( $raw ) );

			if ( '' === $part ) {
				return null;
			}

			if ( isset( self::MODIFIERS[ $part ] ) ) {
				$parsed[ self::MODIFIERS[ $part ] ] = true;
				continue;
			}

			if ( '' !== $parsed['key'] ) {
				return null;
			}

			$parsed['key']  = $part;
			$parsed['code'] = self::code_for( $part );
		}

		return '' === $parsed['key'] ? null : $parsed;
	}

	public function config( array $settings ): array {
		$locale   = $this->resolver->current_locale();
		$entry    = $this->store->entry( $locale );
		$shortcut = $settings['shortcut'] ?? array();
		$load     = $settings['performance'] ?? array();
		$combo    = (string) ( $shortcut['combo'] ?? '' );
		$enabled  = true === ( $shortcut['enabled'] ?? true );

		$config = array(
			'v'           => KOTLINSKIDEV_A11Y_VERSION,
			'locale'      => $locale,
			'rtl'         => $this->resolver->is_rtl_locale( $locale ),
			'storage'     => $settings['storage'] ?? array(),
			'shortcut'    => array(
				'enabled' => $enabled,
				'combo'   => $combo,
				'parsed'  => $enabled ? self::parse_combo( $combo ) : null,
			),
			'load'        => array(
				'strategy'   => (string) ( $load['strategy'] ?? 'interaction' ),
				'prefetch'   => (string) ( $load['prefetch'] ?? 'hover' ),
				'pageCss'    => (string) ( $load['pageCss'] ?? 'lazy' ),
				'deviceSkip' => true === ( $load['deviceSkip'] ?? true ),
			),
			'hiddenMedia' => self::hidden_media( $settings ),
			'chunks'      => array(
				'base' => KOTLINSKIDEV_A11Y_URL . 'build/',
				'ver'  => $this->versions(),
			),
			'data'        => $this->store->urls( $locale ),
			'strings'     => $entry['inline'],
			'advanced'    => array(
				'excludeSelectors' => (string) ( $settings['advanced']['excludeSelectors'] ?? '' ),
			),
			'assets'      => array(
				'dyslexicFontUrl' => KOTLINSKIDEV_A11Y_URL . 'assets/fonts/opendyslexic-regular.woff2',
			),
		);

		if ( true === apply_filters( 'kotlinskidev_a11y_legacy_config', false ) ) {
			return $this->with_legacy_fields( $config, $locale );
		}

		return $config;
	}

	public function script( array $settings ): string {
		return self::GLOBAL_NAME . '=Object.assign(' . self::GLOBAL_NAME . '||{},' . Json::encode( $this->config( $settings ), self::JSON_FLAGS ) . ');';
	}

	private function with_legacy_fields( array $config, string $locale ): array {
		$payload = $this->panel_data->payload( $locale );

		unset( $payload['hash'], $payload['locale'] );

		return array_merge( $config, $payload );
	}

	private function versions(): array {
		$versions = array();

		foreach ( self::CHUNKS as $name ) {
			$versions[ $name ] = Manifest::script( $name )['ver'];
		}

		$versions['page'] = Manifest::style( 'page' )['ver'];

		return $versions;
	}

	private static function code_for( string $key ): string {
		if ( 1 === preg_match( '/^[a-z]$/', $key ) ) {
			return 'Key' . strtoupper( $key );
		}

		if ( 1 === preg_match( '/^\d$/', $key ) ) {
			return 'Digit' . $key;
		}

		return $key;
	}
}
