<?php
declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'kotlinskidev_a11y_api_version' ) ) {
	function kotlinskidev_a11y_api_version(): int {
		return defined( 'KOTLINSKIDEV_A11Y_API' ) ? (int) KOTLINSKIDEV_A11Y_API : 1;
	}
}

if ( ! function_exists( 'kotlinskidev_a11y_get_button' ) ) {
	function kotlinskidev_a11y_get_button( array $args = array() ): string {
		return ( new \Kotlinskidev\A11y\Triggers\Button() )->render( $args );
	}
}

if ( ! function_exists( 'kotlinskidev_a11y_button' ) ) {
	function kotlinskidev_a11y_button( array $args = array() ): void {
		$button = new \Kotlinskidev\A11y\Triggers\Button();
		echo wp_kses( $button->render( $args ), $button->allowed_html() );
	}
}
