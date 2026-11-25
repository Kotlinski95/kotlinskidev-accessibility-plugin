<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Triggers;

use Kotlinskidev\A11y\Frontend\Actions;
use Kotlinskidev\A11y\Frontend\Markup;
use Kotlinskidev\A11y\Frontend\PanelData;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Repository;

final class Button {

	public const MAX_LABEL_LENGTH = 100;
	public const MAX_CLASSES      = 10;

	private const DEFAULTS = array(
		'action'    => 'open',
		'label'     => '',
		'element'   => 'button',
		'class'     => '',
		'show_icon' => false,
		'style'     => '',
	);

	private const ARIA_DIALOG = array(
		'aria-controls' => 'ka11y-root',
		'aria-expanded' => 'false',
		'aria-haspopup' => 'dialog',
	);

	private const LABEL_KEYS = array(
		'open'      => 'triggerOpen',
		'close'     => 'triggerClose',
		'toggle'    => 'triggerToggle',
		'reset'     => 'triggerReset',
		'statement' => 'triggerStatement',
		'hide'      => 'triggerHide',
		'show'      => 'triggerShow',
	);

	private Repository $repository;
	private Visibility $visibility;
	private Strings $strings;
	private LanguageResolver $resolver;

	public function __construct( ?Repository $repository = null, ?Visibility $visibility = null, ?Strings $strings = null, ?LanguageResolver $resolver = null ) {
		$this->repository = $repository ?? new Repository();
		$this->visibility = $visibility ?? new Visibility( $this->repository );
		$this->strings    = $strings ?? new Strings( $this->repository );
		$this->resolver   = $resolver ?? new LanguageResolver();
	}

	public function render( array $args = array() ): string {
		if ( ! $this->visibility->should_render() ) {
			return '';
		}

		$args     = array_merge( self::DEFAULTS, $args );
		$action   = is_string( $args['action'] ) ? trim( $args['action'] ) : '';
		$settings = $this->repository->get();

		if ( ! Actions::is_allowed( $action, $settings ) ) {
			return '';
		}

		$locale  = $this->resolver->current_locale();
		$strings = $this->strings->for_locale( $locale );
		$label   = $this->label( $args['label'], $action, $strings );
		$classes = $this->classes( $args['class'] );
		$style   = is_string( $args['style'] ) ? $args['style'] : '';
		$icon    = $this->is_true( $args['show_icon'] ) ? Markup::ICON : '';

		$statement_url = 'statement' === $action ? $this->statement_url( $settings ) : '';

		if ( '' !== $statement_url ) {
			$html = '<a href="' . esc_url( $statement_url ) . '"' . $this->common_attributes( $classes, $style ) . '>' . $icon . esc_html( $label ) . '</a>';
		} elseif ( 'link' === $args['element'] ) {
			$html = '<a href="#ka11y/' . esc_attr( $action ) . '"' . $this->common_attributes( $classes, $style ) . ' data-ka11y="' . esc_attr( $action ) . '" role="button"' . $this->aria( $action ) . '>' . $icon . esc_html( $label ) . '</a>';
		} else {
			$html = '<button type="button"' . $this->common_attributes( $classes, $style ) . ' data-ka11y="' . esc_attr( $action ) . '"' . $this->aria( $action ) . '>' . $icon . esc_html( $label ) . '</button>';
		}

		$html = (string) apply_filters( 'kotlinskidev_a11y_button_html', $html, $args );

		return wp_kses( $html, $this->allowed_html() );
	}

	private function label( mixed $requested, string $action, array $strings ): string {
		$text = is_string( $requested ) ? sanitize_text_field( $requested ) : '';
		$text = mb_substr( $text, 0, self::MAX_LABEL_LENGTH );

		if ( '' !== $text ) {
			return $text;
		}

		$parsed = Actions::parse( $action );
		$name   = (string) ( $parsed['name'] ?? '' );
		$key    = (string) ( $parsed['key'] ?? '' );

		if ( 'feature' === $name ) {
			return (string) ( $strings[ 'features.' . $key . '.label' ] ?? '' );
		}

		if ( 'profile' === $name ) {
			return (string) ( $strings[ 'profiles.' . $key ] ?? '' );
		}

		return (string) ( $strings[ self::LABEL_KEYS[ $name ] ?? 'open' ] ?? '' );
	}

	private function classes( mixed $requested ): string {
		$tokens = array( 'ka11y-trigger' );

		if ( is_string( $requested ) ) {
			$parts  = preg_split( '/\s+/', $requested );
			$extra  = array_filter( array_map( 'sanitize_html_class', false === $parts ? array() : $parts ), static fn ( string $token ): bool => '' !== $token );
			$tokens = array_merge( $tokens, array_slice( array_values( array_unique( $extra ) ), 0, self::MAX_CLASSES ) );
		}

		return implode( ' ', $tokens );
	}

	private function common_attributes( string $classes, string $style ): string {
		$attributes = ' class="' . esc_attr( $classes ) . '"';

		if ( '' !== $style ) {
			$attributes .= ' style="' . esc_attr( $style ) . '"';
		}

		return $attributes;
	}

	private function aria( string $action ): string {
		$parsed = Actions::parse( $action );
		$name   = (string) ( $parsed['name'] ?? '' );
		$pairs  = array();

		if ( in_array( $name, array( 'open', 'toggle' ), true ) ) {
			$pairs = self::ARIA_DIALOG;
		} elseif ( 'close' === $name ) {
			$pairs = array( 'aria-controls' => 'ka11y-root' );
		} elseif ( in_array( $name, array( 'feature', 'profile' ), true ) ) {
			$pairs = array( 'aria-pressed' => 'false' );
		}

		$html = '';

		foreach ( $pairs as $attribute => $value ) {
			$html .= ' ' . $attribute . '="' . esc_attr( $value ) . '"';
		}

		return $html;
	}

	private function statement_url( array $settings ): string {
		return ( new PanelData( $this->repository, $this->strings ) )->statement_url( $settings );
	}

	private function is_true( mixed $value ): bool {
		return true === $value || ( is_string( $value ) && in_array( strtolower( $value ), array( '1', 'true', 'yes' ), true ) ) || 1 === $value;
	}

	private function allowed_html(): array {
		$shared = array(
			'class'         => true,
			'style'         => true,
			'data-ka11y'    => true,
			'aria-controls' => true,
			'aria-expanded' => true,
			'aria-haspopup' => true,
			'aria-pressed'  => true,
		);

		return array(
			'button' => $shared + array( 'type' => true ),
			'a'      => $shared + array(
				'href' => true,
				'role' => true,
			),
		) + Markup::svg_allowed_html();
	}
}
