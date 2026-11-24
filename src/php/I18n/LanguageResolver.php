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

	public function is_rtl_locale( string $locale ): bool {
		$wp_locale = $GLOBALS['wp_locale'] ?? null;

		if ( is_object( $wp_locale ) && isset( $wp_locale->text_direction ) && get_locale() === $locale ) {
			return 'rtl' === $wp_locale->text_direction;
		}

		$language = strtolower( (string) preg_split( '/[_\-]/', $locale )[0] );

		return in_array( $language, self::RTL_LANGUAGES, true );
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
