<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Frontend\PanelData;
use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\Settings\Sanitizer;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class PanelDataController {

	public const ROUTE_BASE = 'kotlinskidev-a11y/v1';

	private PanelData $panel_data;
	private LanguageResolver $resolver;

	public function __construct( ?PanelData $panel_data = null, ?LanguageResolver $resolver = null ) {
		$this->panel_data = $panel_data ?? new PanelData();
		$this->resolver   = $resolver ?? new LanguageResolver();
	}

	public function register_routes(): void {
		register_rest_route(
			self::ROUTE_BASE,
			'/panel-data',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_panel_data' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'locale' => array(
						'required'          => true,
						'type'              => 'string',
						'validate_callback' => array( $this, 'is_locale' ),
					),
					'v'      => array(
						'required'          => false,
						'type'              => 'string',
						'validate_callback' => array( $this, 'is_version' ),
					),
				),
			)
		);
	}

	public function is_locale( mixed $value ): bool {
		return is_string( $value ) && 1 === preg_match( Sanitizer::LOCALE_PATTERN, $value );
	}

	public function is_version( mixed $value ): bool {
		return is_string( $value ) && 1 === preg_match( '/^[0-9a-f]{12}$/', $value );
	}

	public function get_panel_data( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$locale = (string) $request->get_param( 'locale' );

		if ( ! in_array( $locale, $this->resolver->known_locales(), true ) ) {
			return new WP_Error(
				'kotlinskidev_a11y_unknown_locale',
				__( 'Unknown locale.', 'kotlinskidev-accessibility' ),
				array( 'status' => 404 )
			);
		}

		$payload  = $this->panel_data->payload( $locale );
		$response = new WP_REST_Response( $payload );
		$current  = (string) $request->get_param( 'v' ) === $payload['hash'];

		$response->header( 'Cache-Control', $current ? 'public, max-age=31536000, immutable' : 'public, max-age=600' );
		$response->header( 'X-Content-Type-Options', 'nosniff' );

		return $response;
	}
}
