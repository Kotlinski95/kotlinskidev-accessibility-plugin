<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\I18n;

final class LanguageResolver {

	private const RTL_LANGUAGES = array( 'ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ckb', 'yi', 'dv' );

	public function current_locale(): string {
		$locale = $this->from_polylang()
			?? $this->from_wpml()
			?? $this->from_translatepress()
			?? $this->from_wordpress();

		return (string) apply_filters( 'kotlinskidev_a11y_current_locale', $locale );
	}

	public function known_locales(): array {
		$plugin_locales = array_merge( $this->polylang_locales(), $this->wpml_locales(), $this->translatepress_locales() );
		$plugin_locales = array_filter( $plugin_locales, static fn ( mixed $locale ): bool => is_string( $locale ) && '' !== $locale );
		$locales        = array() !== $plugin_locales
			? array_merge( array( $this->current_locale() ), $plugin_locales )
			: array_merge(
				array( $this->current_locale(), 'en_US' ),
				function_exists( 'get_available_languages' ) ? get_available_languages() : array()
			);

		$filtered = apply_filters( 'kotlinskidev_a11y_known_locales', $locales );
		$strings  = array_filter( is_array( $filtered ) ? $filtered : array(), 'is_string' );

		return array_values( array_unique( array_filter( $strings, static fn ( string $locale ): bool => '' !== $locale ) ) );
	}

	public function locale_label( string $locale ): string {
		$label = $locale;

		if ( class_exists( \Locale::class ) ) {
			$name = \Locale::getDisplayLanguage( $locale, $locale );

			if ( '' !== $name && $name !== $locale ) {
				$label = $name;
			}
		}

		return (string) apply_filters( 'kotlinskidev_a11y_locale_label', $label, $locale );
	}

	public function is_rtl_locale( string $locale ): bool {
		$wp_locale = $GLOBALS['wp_locale'] ?? null;

		if ( is_object( $wp_locale ) && isset( $wp_locale->text_direction ) && get_locale() === $locale ) {
			return 'rtl' === $wp_locale->text_direction;
		}

		$parts    = preg_split( '/[_\-]/', $locale );
		$language = strtolower( false === $parts ? '' : $parts[0] );

		return in_array( $language, self::RTL_LANGUAGES, true );
	}

	private function polylang_locales(): array {
		if ( ! function_exists( 'pll_languages_list' ) ) {
			return array();
		}

		$list = pll_languages_list( array( 'fields' => 'locale' ) );

		return is_array( $list ) ? $list : array();
	}

	private function wpml_locales(): array {
		$languages = apply_filters( 'wpml_active_languages', null );
		$locales   = array();

		foreach ( is_array( $languages ) ? $languages : array() as $code => $language ) {
			$locales[] = is_array( $language ) && isset( $language['default_locale'] ) ? $language['default_locale'] : $this->locale_from_code( (string) $code );
		}

		return $locales;
	}

	private function translatepress_locales(): array {
		$settings = get_option( 'trp_settings', array() );
		$list     = is_array( $settings ) ? ( $settings['translation-languages'] ?? array() ) : array();

		return is_array( $list ) ? array_values( $list ) : array();
	}

	private function from_polylang(): ?string {
		if ( ! function_exists( 'pll_current_language' ) ) {
			return null;
		}

		return $this->non_empty( pll_current_language( 'locale' ) );
	}

	private function from_wpml(): ?string {
		$code = $this->non_empty( apply_filters( 'wpml_current_language', null ) );

		if ( null === $code ) {
			return null;
		}

		$languages = apply_filters( 'wpml_active_languages', null );
		$mapped    = is_array( $languages ) && isset( $languages[ $code ]['default_locale'] )
			? $this->non_empty( $languages[ $code ]['default_locale'] )
			: null;

		return $mapped ?? $this->locale_from_code( $code );
	}

	private function from_translatepress(): ?string {
		return $this->non_empty( $GLOBALS['TRP_LANGUAGE'] ?? null );
	}

	private function from_wordpress(): string {
		return (string) determine_locale();
	}

	private function locale_from_code( string $code ): string {
		if ( str_contains( $code, '-' ) ) {
			return str_replace( '-', '_', $code );
		}

		return $code;
	}

	private function non_empty( mixed $value ): ?string {
		return is_string( $value ) && '' !== $value ? $value : null;
	}
}
