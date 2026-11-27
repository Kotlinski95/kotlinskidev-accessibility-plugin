<?php
declare(strict_types=1);

namespace {

	if ( ! class_exists( 'WpCliFailure' ) ) {
		class WpCliFailure extends RuntimeException {}
	}

	if ( ! class_exists( 'WP_CLI' ) ) {
		class WP_CLI {

			public static array $commands      = array();
			public static array $successes     = array();
			public static array $warnings      = array();
			public static array $lines         = array();
			public static array $printed       = array();
			public static array $tables        = array();
			public static array $confirmations = array();
			public static bool $decline        = false;

			public static function reset(): void {
				self::$commands      = array();
				self::$successes     = array();
				self::$warnings      = array();
				self::$lines         = array();
				self::$printed       = array();
				self::$tables        = array();
				self::$confirmations = array();
				self::$decline       = false;
			}

			public static function add_command( string $name, mixed $callable, array $args = array() ): bool {
				self::$commands[ $name ] = array(
					'callable' => $callable,
					'args'     => $args,
				);

				return true;
			}

			public static function success( string $message ): void {
				self::$successes[] = $message;
			}

			public static function warning( string $message ): void {
				self::$warnings[] = $message;
			}

			public static function line( string $message = '' ): void {
				self::$lines[] = $message;
			}

			public static function print_value( mixed $value, array $assoc_args = array() ): void {
				self::$printed[] = array(
					'value'  => $value,
					'format' => $assoc_args['format'] ?? null,
				);
			}

			public static function confirm( string $question, array $assoc_args = array() ): void {
				self::$confirmations[] = $question;

				if ( empty( $assoc_args['yes'] ) && self::$decline ) {
					throw new WpCliFailure( 'Aborted', 1 );
				}
			}

			public static function error( string|WP_Error $message, bool|int $exit = true ): never {
				throw new WpCliFailure( is_string( $message ) ? $message : $message->get_error_message(), 1 );
			}
		}
	}

	if ( ! class_exists( 'WP_Filesystem_Direct' ) ) {
		class WP_Filesystem_Direct {

			public function __construct( mixed $arg = null ) {}

			public function get_contents( string $file ): string|false {
				return file_get_contents( $file );
			}

			public function put_contents( string $file, string $contents, int|false $mode = false ): bool {
				return false !== file_put_contents( $file, $contents );
			}
		}
	}
}

namespace WP_CLI\Utils {

	function format_items( string $format, array $items, array|string $fields ): void {
		\WP_CLI::$tables[] = array(
			'format' => $format,
			'items'  => $items,
			'fields' => $fields,
		);
	}
}
