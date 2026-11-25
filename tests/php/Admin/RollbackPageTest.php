<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\RollbackPage;
use Kotlinskidev\A11y\Tests\TestCase;

final class RollbackPageTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'esc_html__' )->returnArg( 1 );
	}

	public function test_action_is_bound_to_the_version(): void {
		$this->assertSame( 'kotlinskidev_a11y_rollback_0.4.0', RollbackPage::action( '0.4.0' ) );
	}

	public function test_registers_on_the_site_or_network_menu(): void {
		$page = new RollbackPage();

		Functions\when( 'is_multisite' )->justReturn( true );
		Functions\expect( 'add_action' )->once()->with( 'network_admin_menu', array( $page, 'add_menu' ) );
		$page->register();

		Functions\when( 'is_multisite' )->justReturn( false );
		Functions\expect( 'add_action' )->once()->with( 'admin_menu', array( $page, 'add_menu' ) );
		$page->register();

		$this->addToAssertionCount( 1 );
	}

	public function test_hidden_page_requires_update_plugins(): void {
		Functions\expect( 'add_submenu_page' )->once()->with( '', \Mockery::type( 'string' ), '', 'update_plugins', 'kotlinskidev-a11y-rollback', \Mockery::type( 'array' ) );

		( new RollbackPage() )->add_menu();
		$this->addToAssertionCount( 1 );
	}

	public function test_render_is_forbidden_without_the_capability(): void {
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\expect( 'wp_die' )->once()->andThrow( new \RuntimeException( 'died' ) );

		$this->expectException( \RuntimeException::class );

		( new RollbackPage() )->render();
	}

	public function test_render_rejects_a_missing_nonce_and_a_bad_version(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'wp_unslash' )->returnArg( 1 );
		Functions\when( 'wp_verify_nonce' )->justReturn( false );
		Functions\expect( 'wp_die' )->once()->andThrow( new \RuntimeException( 'died' ) );

		$_GET['version'] = '0.4.0';

		try {
			( new RollbackPage() )->render();
			$this->fail( 'render should die' );
		} catch ( \RuntimeException $exception ) {
			$this->assertSame( 'died', $exception->getMessage() );
		} finally {
			unset( $_GET['version'] );
		}
	}
}
