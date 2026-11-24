<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Support;

final class Json {

	public static function encode( mixed $value, int $flags = 0 ): string {
		$encoded = wp_json_encode( $value, $flags );

		return is_string( $encoded ) ? $encoded : '{}';
	}
}
