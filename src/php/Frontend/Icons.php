<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Settings\Schema;

final class Icons {

	public const PATH_PATTERN = '/^[MmZzLlHhVvCcSsQqTtAa0-9eE.,+\s-]{1,1500}$/';

	private const UI_NAMES = array( 'close', 'plus', 'minus', 'check', 'chevron', 'access', 'language', 'reset' );

	public static function names(): array {
		return array_merge( Schema::feature_keys(), Schema::profile_keys(), self::UI_NAMES );
	}

	public static function map( ?string $path = null ): array {
		$stored   = self::read( $path ?? KOTLINSKIDEV_A11Y_DIR . 'build/icons.json' );
		$filtered = apply_filters( 'kotlinskidev_a11y_icons', $stored );

		return self::sanitize( is_array( $filtered ) ? $filtered : array() );
	}

	private static function read( string $path ): array {
		if ( ! is_readable( $path ) ) {
			return array();
		}

		$decoded = json_decode( implode( '', (array) file( $path ) ), true );
		$icons   = is_array( $decoded ) ? ( $decoded['icons'] ?? array() ) : array();

		return is_array( $icons ) ? $icons : array();
	}

	private static function sanitize( array $icons ): array {
		$clean = array();

		foreach ( self::names() as $name ) {
			$data = $icons[ $name ] ?? null;

			if ( is_string( $data ) && 1 === preg_match( self::PATH_PATTERN, $data ) ) {
				$clean[ $name ] = $data;
			}
		}

		return $clean;
	}
}
