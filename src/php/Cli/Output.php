<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cli;

use WP_CLI;

final class Output {

	public const TABLE_FORMATS = array( 'table', 'json', 'yaml' );

	public const VALUE_FORMATS = array( 'json', 'yaml', 'var_export' );

	public static function format( array $assoc_args, array $allowed, string $fallback ): string {
		$format = $assoc_args['format'] ?? $fallback;

		if ( ! is_string( $format ) || ! in_array( $format, $allowed, true ) ) {
			WP_CLI::error( __( 'Invalid format. Use one of:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', $allowed ) . '.' );
		}

		return $format;
	}

	public static function rows( string $format, array $rows, array $fields ): void {
		WP_CLI\Utils\format_items( $format, $rows, $fields );
	}

	public static function text( mixed $value ): string {
		if ( is_string( $value ) ) {
			return $value;
		}

		return (string) wp_json_encode( $value );
	}

	public static function flag( array $assoc_args, string $name ): bool {
		return true === filter_var( $assoc_args[ $name ] ?? false, FILTER_VALIDATE_BOOLEAN );
	}

	public static function network( array $assoc_args ): bool {
		if ( ! self::flag( $assoc_args, 'network' ) ) {
			return false;
		}

		if ( ! is_multisite() ) {
			WP_CLI::error( __( 'Network settings need a multisite installation.', 'kotlinskidev-accessibility' ) );
		}

		return true;
	}
}
