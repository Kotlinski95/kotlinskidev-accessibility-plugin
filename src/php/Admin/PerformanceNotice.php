<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Settings\Repository;

final class PerformanceNotice {

	public const META_KEY = 'kotlinskidev_a11y_perf_notice_dismissed';

	public const ACTION = 'kotlinskidev_a11y_dismiss_perf_notice';

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function register(): void {
		add_action( 'admin_notices', array( $this, 'render' ) );
		add_action( 'admin_post_' . self::ACTION, array( $this, 'dismiss' ) );
	}

	public function capability(): string {
		return (string) apply_filters( 'kotlinskidev_a11y_capability', 'manage_options' );
	}

	public function should_show( int $user_id ): bool {
		if ( ! current_user_can( $this->capability() ) ) {
			return false;
		}

		if ( ! empty( get_user_meta( $user_id, self::META_KEY, true ) ) ) {
			return false;
		}

		$performance = $this->repository->get()['performance'] ?? array();

		if ( ! is_array( $performance ) ) {
			return false;
		}

		return 'custom' === ( $performance['preset'] ?? null )
			&& in_array( $performance['strategy'] ?? null, array( 'defer', 'idle' ), true )
			&& 'linked' === ( $performance['pageCss'] ?? null );
	}

	public function render(): void {
		if ( ! $this->should_show( get_current_user_id() ) ) {
			return;
		}

		$dismiss_url = wp_nonce_url(
			admin_url( 'admin-post.php?action=' . self::ACTION ),
			self::ACTION
		);

		printf(
			'<div class="notice notice-info ka11y-perf-notice"><p>%1$s <a href="%2$s">%3$s</a> | <a href="%4$s">%5$s</a></p></div>',
			esc_html__( 'Accessibility: switch to the Recommended performance preset to load less JavaScript on every page.', 'kotlinskidev-accessibility' ),
			esc_url( admin_url( 'options-general.php?page=' . SettingsPage::SLUG . '#performance' ) ),
			esc_html__( 'Open performance settings', 'kotlinskidev-accessibility' ),
			esc_url( $dismiss_url ),
			esc_html__( 'Dismiss', 'kotlinskidev-accessibility' )
		);
	}

	public function dismiss(): void {
		check_admin_referer( self::ACTION );

		if ( ! current_user_can( $this->capability() ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'kotlinskidev-accessibility' ), '', array( 'response' => 403 ) );
		}

		update_user_meta( get_current_user_id(), self::META_KEY, '1' );

		wp_safe_redirect( admin_url( 'options-general.php?page=' . SettingsPage::SLUG ) );
		exit;
	}
}
