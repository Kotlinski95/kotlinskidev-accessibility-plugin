<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

final class Locks {

	public const CONSTANT = 'KOTLINSKIDEV_A11Y_LOCKED_SETTINGS';

	private Sanitizer $sanitizer;

	public function __construct( ?Sanitizer $sanitizer = null ) {
		$this->sanitizer = $sanitizer ?? new Sanitizer();
	}

	public function resolve( array $network, ?array $constant = null ): array {
		$filtered = apply_filters( 'kotlinskidev_a11y_locked_settings', $network );
		$merged   = array_merge( is_array( $filtered ) ? $filtered : $network, $constant ?? array() );
		$locked   = array();
		$errors   = array();

		foreach ( $merged as $path => $value ) {
			$reason = $this->reject_reason( (string) $path, $value );

			if ( null === $reason ) {
				$locked[ (string) $path ] = $value;
			} else {
				$errors[ (string) $path ] = $reason;
			}
		}

		return array(
			'locked' => $locked,
			'errors' => $errors,
		);
	}

	public function declared_constant(): ?array {
		if ( ! defined( self::CONSTANT ) ) {
			return null;
		}

		$value = constant( self::CONSTANT );

		return is_array( $value ) ? $value : null;
	}

	public static function apply( array $tree, array $locked ): array {
		foreach ( $locked as $path => $value ) {
			Schema::assign( $tree, $path, $value );
		}

		return $tree;
	}

	private function reject_reason( string $path, mixed $value ): ?string {
		$definition = Schema::definition( $path );

		if ( null === $definition ) {
			return 'unknown_path';
		}

		if ( 'schemaVersion' === $path ) {
			return 'not_lockable';
		}

		return $this->sanitizer->sanitize_value( $value, $definition ) === $value ? null : 'invalid_value';
	}
}
