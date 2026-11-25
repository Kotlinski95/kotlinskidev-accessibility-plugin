<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Triggers;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Settings\Schema;

trait TriggerEnvironment {

	private function trigger_environment( array $settings = array() ): void {
		$stored = array_merge( array( 'schemaVersion' => Schema::VERSION ), $settings );

		Functions\stubs(
			array(
				'__'                    => static fn ( $text ) => $text,
				'esc_html'              => static fn ( $text ) => htmlspecialchars( (string) $text ),
				'esc_attr'              => static fn ( $text ) => htmlspecialchars( (string) $text ),
				'esc_url'               => static fn ( $url ) => htmlspecialchars( (string) $url ),
				'sanitize_html_class'   => static fn ( $value ) => (string) preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $value ),
				'is_admin'              => false,
				'is_feed'               => false,
				'is_customize_preview'  => false,
				'get_queried_object_id' => 0,
				'get_post_type'         => false,
				'home_url'              => 'https://example.test',
				'wp_unslash'            => static fn ( $value ) => $value,
				'switch_to_locale'      => false,
				'determine_locale'      => 'en_US',
				'get_permalink'         => false,
			)
		);
		Functions\when( 'pll_current_language' )->justReturn( false );
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array() ) );
		Functions\when( 'get_option' )->justReturn( $stored );
		Functions\when( 'wp_kses' )->alias(
			static fn ( string $html, array $allowed ): string => strip_tags( $html, '<' . implode( '><', array_keys( $allowed ) ) . '>' )
		);
		$_SERVER['REQUEST_URI'] = '/about/';
	}
}
