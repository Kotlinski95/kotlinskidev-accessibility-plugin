<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Update\Channel;
use Kotlinskidev\A11y\Update\Rollback;
use Kotlinskidev\A11y\Update\Updater;
use WP_Error;

final class RollbackPage {

	public const SLUG       = 'kotlinskidev-a11y-rollback';
	public const CAPABILITY = 'update_plugins';

	private ?Rollback $rollback;

	public function __construct( ?Rollback $rollback = null ) {
		$this->rollback = $rollback;
	}

	public static function action( string $version ): string {
		return 'kotlinskidev_a11y_rollback_' . $version;
	}

	public static function url( string $version ): string {
		$base = is_multisite() ? network_admin_url( 'admin.php' ) : admin_url( 'admin.php' );
		$url  = add_query_arg(
			array(
				'page'    => self::SLUG,
				'version' => $version,
			),
			$base
		);

		return wp_nonce_url( $url, self::action( $version ) );
	}

	public function register(): void {
		add_action( is_multisite() ? 'network_admin_menu' : 'admin_menu', array( $this, 'add_menu' ) );
	}

	public function add_menu(): void {
		add_submenu_page(
			'',
			__( 'Roll back Kotlinskidev Accessibility', 'kotlinskidev-accessibility' ),
			'',
			self::CAPABILITY,
			self::SLUG,
			array( $this, 'render' )
		);
	}

	public function render(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You are not allowed to roll back this plugin.', 'kotlinskidev-accessibility' ), '', array( 'response' => 403 ) );
		}

		$is_post = 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? 'GET' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$version = $this->requested_version( $is_post );
		$action  = self::action( $version );
		$nonce   = $is_post ? $this->field( $_POST, '_wpnonce' ) : $this->field( $_GET, '_wpnonce' ); // phpcs:ignore WordPress.Security.NonceVerification

		if ( ! Rollback::valid_version( $version ) || false === wp_verify_nonce( $nonce, $action ) ) {
			wp_die( esc_html__( 'This rollback link is invalid or expired.', 'kotlinskidev-accessibility' ), '', array( 'response' => 403 ) );
		}

		$rollback = $this->rollback();
		$release  = $rollback->candidate( $version );

		if ( null === $release ) {
			wp_die( esc_html__( 'That version is not available for rollback.', 'kotlinskidev-accessibility' ), '', array( 'response' => 404 ) );
		}

		echo '<div class="wrap"><h1>' . esc_html__( 'Roll back Kotlinskidev Accessibility', 'kotlinskidev-accessibility' ) . '</h1>';

		if ( $is_post ) {
			$this->render_result( $rollback->run( $version ), $version );
		} else {
			$this->render_confirmation( $version, $action );
		}

		echo '</div>';
	}

	private function render_confirmation( string $version, string $action ): void {
		echo '<p>' . esc_html(
			sprintf(
				/* translators: %s: plugin version */
				__( 'Roll back to %1$s. Settings stay. Features added after %2$s stop working.', 'kotlinskidev-accessibility' ),
				$version,
				$version
			)
		) . '</p>';
		echo '<form method="post" action="' . esc_url( self::url( $version ) ) . '">';
		wp_nonce_field( $action );
		echo '<input type="hidden" name="version" value="' . esc_attr( $version ) . '">';
		submit_button( __( 'Roll back', 'kotlinskidev-accessibility' ) );
		echo '</form>';
	}

	private function render_result( true|WP_Error $result, string $version ): void {
		if ( $result instanceof WP_Error ) {
			echo '<div class="notice notice-error"><p>' . esc_html( $result->get_error_message() ) . '</p></div>';

			return;
		}

		echo '<div class="notice notice-success"><p>' . esc_html(
			sprintf(
				/* translators: %s: plugin version */
				__( 'Rolled back to %s. A settings backup is stored in the kotlinskidev_a11y_settings_backup option.', 'kotlinskidev-accessibility' ),
				$version
			)
		) . '</p></div>';
	}

	private function requested_version( bool $is_post ): string {
		return $this->field( $is_post ? $_POST : $_GET, 'version' ); // phpcs:ignore WordPress.Security.NonceVerification
	}

	private function field( array $source, string $key ): string {
		$value = $source[ $key ] ?? '';

		return is_string( $value ) ? sanitize_text_field( wp_unslash( $value ) ) : '';
	}

	private function rollback(): Rollback {
		if ( null === $this->rollback ) {
			$updater        = new Updater( KOTLINSKIDEV_A11Y_FILE );
			$this->rollback = new Rollback( $updater, new Channel(), KOTLINSKIDEV_A11Y_VERSION );
		}

		return $this->rollback;
	}
}
