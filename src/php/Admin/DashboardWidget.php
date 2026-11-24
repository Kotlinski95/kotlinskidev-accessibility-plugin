<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Settings\Repository;

final class DashboardWidget {

	public const WIDGET_ID = 'kotlinskidev_a11y_dashboard';

	private AltTextCounter $counter;

	private Repository $repository;

	public function __construct( ?AltTextCounter $counter = null, ?Repository $repository = null ) {
		$this->counter    = $counter ?? new AltTextCounter();
		$this->repository = $repository ?? new Repository();
	}

	public function register(): void {
		add_action( 'wp_dashboard_setup', array( $this, 'add_widget' ) );
	}

	public function capability(): string {
		return (string) apply_filters( 'kotlinskidev_a11y_capability', 'manage_options' );
	}

	public function add_widget(): void {
		if ( ! current_user_can( $this->capability() ) ) {
			return;
		}

		wp_add_dashboard_widget( self::WIDGET_ID, __( 'Accessibility', 'kotlinskidev-accessibility' ), array( $this, 'render' ) );
	}

	public function enabled_features(): int {
		$features = $this->repository->get()['features'] ?? array();

		if ( ! is_array( $features ) ) {
			return 0;
		}

		return count(
			array_filter(
				$features,
				static fn ( $feature ): bool => is_array( $feature ) && true === ( $feature['enabled'] ?? false )
			)
		);
	}

	public function render(): void {
		$missing = $this->counter->missing_count();
		$enabled = $this->enabled_features();

		printf(
			'<ul class="ka11y-dashboard"><li>%1$s: <strong>%2$s</strong> <a href="%3$s">%4$s</a></li><li>%5$s: <strong>%6$s</strong> <a href="%7$s">%8$s</a></li><li>%9$s: %10$s</li></ul>',
			esc_html__( 'Images without alt text', 'kotlinskidev-accessibility' ),
			esc_html( number_format_i18n( $missing ) ),
			esc_url( admin_url( 'upload.php?page=' . AltTextPage::SLUG ) ),
			esc_html__( 'Fix missing alt text', 'kotlinskidev-accessibility' ),
			esc_html__( 'Enabled features', 'kotlinskidev-accessibility' ),
			esc_html( number_format_i18n( $enabled ) ),
			esc_url( admin_url( 'options-general.php?page=' . SettingsPage::SLUG ) ),
			esc_html__( 'Open settings', 'kotlinskidev-accessibility' ),
			esc_html__( 'Plugin version', 'kotlinskidev-accessibility' ),
			esc_html( KOTLINSKIDEV_A11Y_VERSION )
		);
	}
}
