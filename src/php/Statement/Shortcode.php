<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Statement;

use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Repository;

final class Shortcode {

	public const TAG = 'kotlinskidev_a11y_statement';

	private const SECTIONS = array(
		'statementCommitment',
		'statementConformance',
		'statementFeedback',
		'statementDate',
	);

	private Repository $repository;

	private LanguageResolver $resolver;

	private Strings $strings;

	public function __construct( ?Repository $repository = null, ?LanguageResolver $resolver = null, ?Strings $strings = null ) {
		$this->repository = $repository ?? new Repository();
		$this->resolver   = $resolver ?? new LanguageResolver();
		$this->strings    = $strings ?? new Strings( $this->repository );
	}

	public function register(): void {
		add_shortcode( self::TAG, array( $this, 'render' ) );
	}

	public function render( mixed $atts = array() ): string {
		$attributes = shortcode_atts( array( 'locale' => '' ), is_array( $atts ) ? $atts : array(), self::TAG );
		$requested  = sanitize_text_field( (string) $attributes['locale'] );
		$locale     = '' !== $requested ? $requested : $this->resolver->current_locale();
		$content    = $this->content_for( $locale );
		$body       = '' !== $content ? wp_kses_post( $content ) : $this->template( $locale );

		return sprintf(
			'<div class="ka11y-statement" lang="%1$s">%2$s</div>',
			esc_attr( str_replace( '_', '-', $locale ) ),
			$body
		);
	}

	public function default_locale(): string {
		if ( function_exists( 'pll_default_language' ) ) {
			$polylang = pll_default_language( 'locale' );

			if ( is_string( $polylang ) && '' !== $polylang ) {
				return $polylang;
			}
		}

		$configured = get_option( 'WPLANG' );
		$fallback   = is_string( $configured ) && '' !== $configured ? $configured : 'en_US';

		return (string) apply_filters( 'kotlinskidev_a11y_default_locale', $fallback );
	}

	private function content_for( string $locale ): string {
		$settings = $this->repository->get();
		$content  = $settings['statement']['content'] ?? array();

		if ( ! is_array( $content ) ) {
			return '';
		}

		foreach ( array( $locale, $this->default_locale() ) as $candidate ) {
			$html = $content[ $candidate ] ?? '';

			if ( is_string( $html ) && '' !== trim( $html ) ) {
				return $html;
			}
		}

		return '';
	}

	private function template( string $locale ): string {
		$strings = $this->strings->for_locale( $locale );
		$html    = '<p class="ka11y-statement__empty">' . esc_html( $strings['statementEmpty'] ?? '' ) . '</p>';

		foreach ( self::SECTIONS as $section ) {
			$html .= sprintf(
				'<h2>%1$s</h2><p>%2$s</p>',
				esc_html( $strings[ $section . 'Heading' ] ?? '' ),
				esc_html( $strings[ $section . 'Body' ] ?? '' )
			);
		}

		return $html;
	}
}
