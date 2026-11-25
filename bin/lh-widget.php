<?php
use Kotlinskidev\A11y\Settings\Repository;

$state = $args[0] ?? '';
if ( ! in_array( $state, array( 'on', 'off' ), true ) ) {
	WP_CLI::error( 'usage: wp eval-file lh-widget.php on|off' );
}

$repository = new Repository();
$settings   = $repository->get();

if ( 'off' === $state ) {
	$settings['visibility']['mode']           = 'only_on';
	$settings['visibility']['includePostIds'] = array( 999999 );
} else {
	$settings['visibility']['mode']           = 'everywhere';
	$settings['visibility']['includePostIds'] = array();
	$settings['performance']['preset']        = 'recommended';
}

$repository->save( $settings );
WP_CLI::success( "widget $state" );
