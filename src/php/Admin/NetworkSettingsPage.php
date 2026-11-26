<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Rest\NetworkSettingsController;
use Kotlinskidev\A11y\Rest\SettingsController;

final class NetworkSettingsPage {

	private SettingsPage $page;
	private string|false $hook_suffix = false;

	public function __construct( ?SettingsPage $page = null ) {
		$this->page = $page ?? new SettingsPage();
	}

	public function register(): void {
		add_action( 'network_admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function add_menu(): void {
		$this->hook_suffix = add_submenu_page(
			'settings.php',
			__( 'Accessibility', 'kotlinskidev-accessibility' ),
			__( 'Accessibility', 'kotlinskidev-accessibility' ),
			NetworkSettingsController::CAPABILITY,
			SettingsPage::SLUG,
			array( $this, 'render' )
		);
	}

	public function render(): void {
		if ( ! current_user_can( NetworkSettingsController::CAPABILITY ) ) {
			return;
		}

		$this->page->render_mount( __( 'Accessibility network defaults', 'kotlinskidev-accessibility' ) );
	}

	public function enqueue( string $hook ): void {
		if ( false === $this->hook_suffix || $hook !== $this->hook_suffix ) {
			return;
		}

		$this->page->enqueue_assets( $this->config() );
	}

	public function config(): array {
		return array_merge(
			$this->page->config(),
			array(
				'restRoot' => esc_url_raw( rest_url( SettingsController::REST_NAMESPACE . '/network/' ) ),
				'scope'    => 'network',
			)
		);
	}
}
