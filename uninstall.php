<?php
declare(strict_types=1);

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'kotlinskidev_a11y_settings' );
delete_transient( 'kotlinskidev_a11y_missing_alt' );
