<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Settings\Schema;

final class Actions {

	public const PATTERN = '/^[a-z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+){0,2}$/';
	public const SIMPLE  = array( 'open', 'close', 'toggle', 'reset', 'statement', 'hide', 'show' );
	public const URL     = array( 'open', 'feature', 'profile' );

	private const LEVEL_PATTERN = '/^(0|[1-9][0-9]?)$/';

	public static function parse( string $action ): ?array {
		if ( 1 !== preg_match( self::PATTERN . 'D', $action ) ) {
			return null;
		}

		$parts = explode( ':', $action );
		$name  = $parts[0];
		$key   = $parts[1] ?? null;
		$level = $parts[2] ?? null;

		if ( in_array( $name, self::SIMPLE, true ) ) {
			return null === $key ? self::result( $name, null, null ) : null;
		}

		if ( null === $key ) {
			return null;
		}

		if ( 'profile' === $name ) {
			return null === $level ? self::result( $name, $key, null ) : null;
		}

		if ( 'feature' !== $name ) {
			return null;
		}

		if ( null === $level ) {
			return self::result( $name, $key, null );
		}

		return 1 === preg_match( self::LEVEL_PATTERN, $level ) ? self::result( $name, $key, (int) $level ) : null;
	}

	public static function is_allowed( string $action, array $settings ): bool {
		$parsed = self::parse( $action );

		if ( null === $parsed ) {
			return false;
		}

		if ( null === $parsed['key'] ) {
			return true;
		}

		if ( 'feature' === $parsed['name'] ) {
			return in_array( $parsed['key'], Schema::feature_keys(), true )
				&& true === ( $settings['features'][ $parsed['key'] ]['enabled'] ?? false );
		}

		return in_array( $parsed['key'], Schema::profile_keys(), true )
			&& true === ( $settings['profiles'][ $parsed['key'] ]['enabled'] ?? false );
	}

	private static function result( string $name, ?string $key, ?int $level ): array {
		return array(
			'name'  => $name,
			'key'   => $key,
			'level' => $level,
		);
	}
}
