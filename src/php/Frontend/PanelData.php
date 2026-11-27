<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Support\Credit;
use Kotlinskidev\A11y\Support\Json;

final class PanelData {

	private const JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

	private Repository $repository;
	private Strings $strings;
	private LanguageResolver $resolver;

	public function __construct( ?Repository $repository = null, ?Strings $strings = null, ?LanguageResolver $resolver = null ) {
		$this->repository = $repository ?? new Repository();
		$this->strings    = $strings ?? new Strings( $this->repository );
		$this->resolver   = $resolver ?? new LanguageResolver();
	}

	public function payload( string $locale ): array {
		$settings = $this->repository->get();
		$body     = array(
			'locale'       => $locale,
			'features'     => $settings['features'] ?? array(),
			'profiles'     => $settings['profiles'] ?? array(),
			'widget'       => $settings['widget'] ?? array(),
			'theme'        => $settings['theme'] ?? array(),
			'tokens'       => $settings['tokens'] ?? array(),
			'hideToolbar'  => $settings['hideToolbar'] ?? array(),
			'statementUrl' => $this->statement_url( $settings ),
			'customCss'    => (string) ( $settings['customCss'] ?? '' ),
			'strings'      => $this->strings->for_locale( $locale ),
			'panel'        => $this->panel( $settings ),
			'layout'       => array( 'sheetQuery' => InlineConfig::device_queries( $settings )['mobile'] ),
			'locales'      => $this->locales( $locale ),
			'icons'        => $this->icons(),
		);

		return array( 'hash' => $this->hash( $this->encode( $body ) ) ) + $body;
	}

	private function icons(): array|\stdClass {
		$icons = Icons::map();

		return array() === $icons ? new \stdClass() : $icons;
	}

	private function panel( array $settings ): array {
		$panel    = $settings['panel'] ?? array();
		$sections = array();

		foreach ( Schema::PANEL_SECTIONS as $section ) {
			$sections[ $section ] = false !== ( $panel['sections'][ $section ] ?? true );
		}

		$result = array(
			'columns'          => (int) ( $panel['columns'] ?? 3 ),
			'sections'         => $sections,
			'languageSwitcher' => false !== ( $panel['languageSwitcher'] ?? true ),
			'order'            => $this->order( $panel ),
			'languageMode'     => 'follow' === ( $panel['languageMode'] ?? 'choose' ) ? 'follow' : 'choose',
			'backdrop'         => true === ( $panel['backdrop'] ?? false ),
			'backdropColor'    => (string) ( $panel['backdropColor'] ?? '#000000' ),
			'backdropOpacity'  => (int) ( $panel['backdropOpacity'] ?? 40 ),
			'backdropBlur'     => (int) ( $panel['backdropBlur'] ?? 0 ),
			'closeOnBackdrop'  => false !== ( $panel['closeOnBackdrop'] ?? true ),
			'animation'        => (string) ( $panel['animation'] ?? 'slide' ),
			'animationMs'      => (int) ( $panel['animationMs'] ?? 220 ),
			'width'            => (int) ( $panel['width'] ?? 448 ),
			'side'             => (string) ( $panel['side'] ?? 'auto' ),
			'offset'           => (int) ( $panel['offset'] ?? 0 ),
		);

		$credit = false !== ( $panel['credit'] ?? true ) ? ( new Credit() )->resolve() : null;

		if ( null !== $credit ) {
			$result['credit'] = $credit;
		}

		return $result;
	}

	private function order( array $panel ): array {
		$saved = is_array( $panel['order'] ?? null ) ? $panel['order'] : Schema::feature_keys();

		return array_values( array_unique( array_intersect( $saved, Schema::feature_keys() ) ) );
	}

	private function locales( string $locale ): array {
		$known = array_values( array_unique( array_merge( array( $locale ), $this->resolver->known_locales() ) ) );
		$list  = array();
		$seen  = array();

		foreach ( $known as $code ) {
			$label = $this->resolver->locale_label( $code );
			$key   = function_exists( 'mb_strtolower' ) ? mb_strtolower( $label ) : strtolower( $label );

			if ( isset( $seen[ $key ] ) ) {
				continue;
			}

			$seen[ $key ] = true;
			$list[]       = array(
				'locale' => $code,
				'label'  => $label,
				'rtl'    => $this->resolver->is_rtl_locale( $code ),
			);
		}

		return $list;
	}

	public function encode( array $payload ): string {
		unset( $payload['hash'] );

		return Json::encode( $payload, self::JSON_FLAGS );
	}

	public function document( array $payload ): string {
		return Json::encode( $payload, self::JSON_FLAGS );
	}

	public function hash( string $json ): string {
		return substr( sha1( $json . KOTLINSKIDEV_A11Y_VERSION . Schema::VERSION ), 0, 12 );
	}

	public function statement_url( array $settings ): string {
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
}
