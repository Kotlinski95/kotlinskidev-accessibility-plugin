<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Support;

final class Credit {

	public function resolve(): ?array {
		if ( ! defined( 'KOTLINSKIDEV_A11Y_FILE' ) || ! function_exists( 'get_file_data' ) ) {
			return null;
		}

		$header = get_file_data(
			KOTLINSKIDEV_A11Y_FILE,
			array(
				'name' => 'Author',
				'url'  => 'Author URI',
			),
			'plugin'
		);
		$name   = sanitize_text_field( (string) ( $header['name'] ?? '' ) );
		$url    = esc_url_raw( (string) ( $header['url'] ?? '' ) );

		if ( '' === $name || '' === $url ) {
			return null;
		}

		return array(
			'name' => $name,
			'url'  => $url,
		);
	}
}
