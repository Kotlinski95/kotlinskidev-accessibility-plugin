<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Privacy;

final class PolicyText {

	public const SECTION = 'Kotlinskidev Accessibility';

	public function register(): void {
		add_action( 'admin_init', array( $this, 'add' ) );
	}

	public function add(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		wp_add_privacy_policy_content( self::SECTION, wp_kses_post( $this->html() ) );
	}

	public function html(): string {
		$paragraphs = array(
			__( 'The accessibility widget does not track visitors, run analytics or build profiles. It does not collect personal data and it makes no requests to external services from the visitor\'s browser.', 'kotlinskidev-accessibility' ),
			__( 'Suggested text for a cookie or consent policy: the widget saves a visitor\'s explicit accessibility choices on the visitor\'s own device so they apply on the next visit. This storage is strictly necessary to honour that choice. Nothing is sent to the site or to third parties. When the storage mode is set to none, nothing is stored.', 'kotlinskidev-accessibility' ),
		);

		$device = array(
			__( 'Local storage key "ka11y" (the key name can be changed in the settings): the chosen accessibility options, or a first-party cookie with the same name and the configured lifetime when the cookie mode is on.', 'kotlinskidev-accessibility' ),
			__( 'Local storage key "ka11y-locale": the interface language the visitor picked in the widget.', 'kotlinskidev-accessibility' ),
			__( 'Local storage key "ka11y-hidden": the choice to hide the floating toolbar.', 'kotlinskidev-accessibility' ),
		);

		$site = array(
			__( 'The settings are stored in the site database as one option.', 'kotlinskidev-accessibility' ),
			__( 'Generated panel data files are stored in the uploads folder "kotlinskidev-a11y". They contain interface texts and no visitor data.', 'kotlinskidev-accessibility' ),
			__( 'For administrators only, the server checks GitHub for plugin updates. These requests come from the server, contain no visitor data and carry the site address in the standard WordPress user agent.', 'kotlinskidev-accessibility' ),
		);

		return '<p>' . esc_html( $paragraphs[0] ) . '</p>'
			. '<p><strong>' . esc_html__( 'What the widget stores in the visitor\'s browser', 'kotlinskidev-accessibility' ) . '</strong></p>'
			. $this->list( $device )
			. '<p><strong>' . esc_html__( 'What the plugin stores in the site', 'kotlinskidev-accessibility' ) . '</strong></p>'
			. $this->list( $site )
			. '<p>' . esc_html( $paragraphs[1] ) . '</p>';
	}

	private function list( array $items ): string {
		return '<ul>' . implode( '', array_map( static fn ( string $item ): string => '<li>' . esc_html( $item ) . '</li>', $items ) ) . '</ul>';
	}
}
