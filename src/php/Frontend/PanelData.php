<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Support\Json;

final class PanelData {

	private const JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;

	private Repository $repository;
	private Strings $strings;

	public function __construct( ?Repository $repository = null, ?Strings $strings = null ) {
		$this->repository = $repository ?? new Repository();
		$this->strings    = $strings ?? new Strings( $this->repository );
	}

	public function payload( string $locale ): array {
		$settings = $this->repository->get();
		$body     = array(
			'locale'       => $locale,
			'features'     => $settings['features'] ?? array(),
			'profiles'     => $settings['profiles'] ?? array(),
			'widget'       => $settings['widget'] ?? array(),
			'theme'        => $settings['theme'] ?? array(),
			'tokens'       => $settings['tokens'] ?? array(),
			'hideToolbar'  => $settings['hideToolbar'] ?? array(),
			'statementUrl' => $this->statement_url( $settings ),
			'customCss'    => (string) ( $settings['customCss'] ?? '' ),
			'strings'      => $this->strings->for_locale( $locale ),
		);

		return array( 'hash' => $this->hash( $this->encode( $body ) ) ) + $body;
	}

	public function encode( array $payload ): string {
		unset( $payload['hash'] );

		return Json::encode( $payload, self::JSON_FLAGS );
	}

	public function document( array $payload ): string {
		return Json::encode( $payload, self::JSON_FLAGS );
	}

	public function hash( string $json ): string {
		return substr( sha1( $json . KOTLINSKIDEV_A11Y_VERSION . Schema::VERSION ), 0, 12 );
	}

	private function statement_url( array $settings ): string {
		$statement = $settings['statement'] ?? array();
		$page_id   = (int) ( $statement['pageId'] ?? 0 );

		if ( $page_id > 0 ) {
			$permalink = get_permalink( $page_id );

			if ( is_string( $permalink ) && '' !== $permalink ) {
				return $permalink;
			}
		}

		return (string) ( $statement['url'] ?? '' );
	}
}
