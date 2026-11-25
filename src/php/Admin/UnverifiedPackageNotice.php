<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Update\PackageVerifier;

final class UnverifiedPackageNotice {

	public function register(): void {
		add_action( 'admin_notices', array( $this, 'render' ) );
	}

	public function should_show(): bool {
		if ( ! current_user_can( 'update_plugins' ) ) {
			return false;
		}

		$flag = get_site_option( PackageVerifier::UNVERIFIED_FLAG, '' );

		return is_string( $flag ) && '' !== $flag;
	}

	public function render(): void {
		if ( ! $this->should_show() ) {
			return;
		}

		printf(
			'<div class="notice notice-warning is-dismissible ka11y-unverified-notice"><p>%s</p></div>',
			esc_html__( 'Accessibility: the last plugin update was installed without a SHA-256 checksum, so its integrity was not verified. Install the latest release to restore verified updates.', 'kotlinskidev-accessibility' )
		);
	}
}
