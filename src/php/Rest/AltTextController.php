<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Admin\AltTextCounter;
use Kotlinskidev\A11y\Admin\MissingAltQuery;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class AltTextController {

	private AltTextCounter $counter;

	public function __construct( ?AltTextCounter $counter = null ) {
		$this->counter = $counter ?? new AltTextCounter();
	}

	public function register_routes(): void {
		register_rest_route(
			SettingsController::REST_NAMESPACE,
			'/alt-text/(?P<id>\d+)',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_alt_text' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'id'  => array(
						'type'     => 'integer',
						'required' => true,
					),
					'alt' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
	}

	public function check_permission( WP_REST_Request $request ): bool {
		return current_user_can( 'upload_files' ) && current_user_can( 'edit_post', (int) $request->get_param( 'id' ) );
	}

	public function update_alt_text( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$id = (int) $request->get_param( 'id' );

		if ( 'attachment' !== get_post_type( $id ) ) {
			return new WP_Error(
				'kotlinskidev_a11y_not_attachment',
				__( 'The requested item is not a media attachment.', 'kotlinskidev-accessibility' ),
				array( 'status' => 404 )
			);
		}

		$alt = sanitize_text_field( (string) $request->get_param( 'alt' ) );

		update_post_meta( $id, MissingAltQuery::META_KEY, $alt );
		$this->counter->flush();

		return new WP_REST_Response(
			array(
				'id'        => $id,
				'alt'       => $alt,
				'remaining' => $this->counter->missing_count(),
			)
		);
	}
}
