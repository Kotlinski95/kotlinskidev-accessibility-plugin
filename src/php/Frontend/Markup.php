<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Repository;

final class Markup {

	private const DEVICES = array( 'desktop', 'tablet', 'mobile' );
	private const ICON    = '<svg class="ka11y-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="currentColor"><circle cx="12" cy="4.5" r="2.2"/><path d="M4 8.5h16v2.2h-6.4v3.1l2.5 6.2-2 .8L12 15.8l-2.1 5-2-.8 2.5-6.2v-3.1H4z"/></svg>';

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
		add_action( 'wp_footer', array( $this, 'render' ) );
	}

	public function render(): void {
		if ( ! $this->visibility->should_render() ) {
			return;
		}

		echo wp_kses( $this->html( $this->repository->get() ), $this->allowed_html() );
	}

	public function html( array $settings ): string {
		$strings = $this->strings->for_locale( $this->resolver->current_locale() );
		$label   = (string) ( $strings['open'] ?? '' );
		$widget  = $settings['widget'] ?? array();

		return '<div id="ka11y-root"' . $this->root_attributes( $widget ) . '>'
			. '<button type="button" class="ka11y-launcher" aria-label="' . esc_attr( $label ) . '" aria-haspopup="dialog" aria-expanded="false">'
			. $this->icon( $widget['icon'] ?? 'universal' )
			. '</button></div>';
	}

	private function root_attributes( array $widget ): string {
		$attributes = '';

		foreach ( self::DEVICES as $device ) {
			$position    = (string) ( $widget['position'][ $device ] ?? 'bottom-right' );
			$attributes .= ' data-ka11y-position-' . $device . '="' . esc_attr( $position ) . '"';
		}

		$attributes .= ' data-ka11y-size="' . esc_attr( (string) ( $widget['size'] ?? 'md' ) ) . '"';
		$attributes .= ' data-ka11y-icon-border="' . ( true === ( $widget['iconBorder'] ?? false ) ? 'true' : 'false' ) . '"';

		return $attributes;
	}

	private function icon( mixed $icon ): string {
		$attachment_id = is_scalar( $icon ) && ctype_digit( (string) $icon ) ? (int) $icon : 0;

		if ( $attachment_id > 0 ) {
			$url = wp_get_attachment_image_url( $attachment_id, 'full' );

			if ( is_string( $url ) && '' !== $url ) {
				return '<img class="ka11y-icon" src="' . esc_url( $url ) . '" alt="" width="28" height="28" decoding="async">';
			}
		}

		return self::ICON;
	}

	private function allowed_html(): array {
		$svg_attributes = array(
			'class'       => true,
			'viewbox'     => true,
			'width'       => true,
			'height'      => true,
			'aria-hidden' => true,
			'focusable'   => true,
			'fill'        => true,
			'cx'          => true,
			'cy'          => true,
			'r'           => true,
			'd'           => true,
		);

		return array(
			'div'    => array(
				'id'                          => true,
				'data-ka11y-position-desktop' => true,
				'data-ka11y-position-tablet'  => true,
				'data-ka11y-position-mobile'  => true,
				'data-ka11y-size'             => true,
				'data-ka11y-icon-border'      => true,
			),
			'button' => array(
				'type'          => true,
				'class'         => true,
				'aria-label'    => true,
				'aria-haspopup' => true,
				'aria-expanded' => true,
			),
			'img'    => array(
				'class'    => true,
				'src'      => true,
				'alt'      => true,
				'width'    => true,
				'height'   => true,
				'decoding' => true,
			),
			'svg'    => $svg_attributes,
			'circle' => $svg_attributes,
			'path'   => $svg_attributes,
		);
	}
}
