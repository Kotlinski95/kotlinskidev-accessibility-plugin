<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Update;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Plugin;
use Kotlinskidev\A11y\Tests\TestCase;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;

final class PluginRegistrationTest extends TestCase {

	public function test_updater_context_helper_matches_admin_and_cron_only(): void {
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'wp_doing_cron' )->justReturn( false );
		$this->assertFalse( Plugin::should_check_updates() );

		Functions\when( 'is_admin' )->justReturn( true );
		$this->assertTrue( Plugin::should_check_updates() );

		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'wp_doing_cron' )->justReturn( true );
		$this->assertTrue( Plugin::should_check_updates() );
	}

	#[RunInSeparateProcess]
	#[PreserveGlobalState( false )]
	public function test_wp_cli_context_checks_updates(): void {
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'wp_doing_cron' )->justReturn( false );
		define( 'WP_CLI', true );

		$this->assertTrue( Plugin::should_check_updates() );
	}
}
