<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Requirements;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once dirname( __DIR__, 3 ) . '/src/php/requirements.php';

final class RequirementsTest extends TestCase {

	private string $dir = '';

	protected function setUp(): void {
		parent::setUp();
		$this->dir = sys_get_temp_dir() . '/ka11y-req-' . uniqid( '', true ) . '/';
		mkdir( $this->dir . 'vendor', 0777, true );
		mkdir( $this->dir . 'build', 0777, true );
		Functions\stubs(
			array(
				'esc_html__' => static fn ( $text ): string => (string) $text,
			)
		);
	}

	protected function tearDown(): void {
		array_map( 'unlink', glob( $this->dir . '*/*' ) ?: array() );
		rmdir( $this->dir . 'vendor' );
		rmdir( $this->dir . 'build' );
		rmdir( $this->dir );
		parent::tearDown();
	}

	private function complete(): void {
		touch( $this->dir . 'vendor/autoload.php' );
		touch( $this->dir . 'build/loader.js' );
		touch( $this->dir . 'build/bootstrap.js' );
		touch( $this->dir . 'build/launcher.css' );
		touch( $this->dir . 'build/manifest.php' );
	}

	public function test_complete_install_registers_no_notice(): void {
		$this->complete();

		$this->assertTrue( kotlinskidev_a11y_requirements_met( $this->dir ) );
		$this->assertFalse( has_action( 'admin_notices', 'kotlinskidev_a11y_render_incomplete_notice' ) );
	}

	public function test_missing_vendor_registers_notice_and_reports_failure(): void {
		touch( $this->dir . 'build/loader.js' );
		touch( $this->dir . 'build/bootstrap.js' );
		touch( $this->dir . 'build/launcher.css' );
		touch( $this->dir . 'build/manifest.php' );

		$this->assertSame( array( 'vendor/autoload.php' ), kotlinskidev_a11y_missing_files( $this->dir ) );
		Actions\expectAdded( 'admin_notices' )->once()->with( 'kotlinskidev_a11y_render_incomplete_notice' );
		$this->assertFalse( kotlinskidev_a11y_requirements_met( $this->dir ) );
	}

	public function test_missing_build_registers_notice(): void {
		touch( $this->dir . 'vendor/autoload.php' );

		$this->assertSame( array( 'build/loader.js', 'build/bootstrap.js', 'build/launcher.css', 'build/manifest.php' ), kotlinskidev_a11y_missing_files( $this->dir ) );
		Actions\expectAdded( 'admin_notices' )->once();
		$this->assertFalse( kotlinskidev_a11y_requirements_met( $this->dir ) );
	}

	public function test_missing_bootstrap_or_launcher_css_is_reported(): void {
		touch( $this->dir . 'vendor/autoload.php' );
		touch( $this->dir . 'build/loader.js' );
		touch( $this->dir . 'build/manifest.php' );

		$this->assertSame( array( 'build/bootstrap.js', 'build/launcher.css' ), kotlinskidev_a11y_missing_files( $this->dir ) );
	}

	public function test_notice_is_hidden_without_manage_options(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		ob_start();
		kotlinskidev_a11y_render_incomplete_notice();

		$this->assertSame( '', ob_get_clean() );
	}

	public function test_notice_names_the_release_zip_for_admins(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'manage_options' )->andReturn( true );

		ob_start();
		kotlinskidev_a11y_render_incomplete_notice();
		$html = (string) ob_get_clean();

		$this->assertStringContainsString( 'notice-error', $html );
		$this->assertStringContainsString( 'kotlinskidev-accessibility.zip', $html );
		$this->assertStringContainsString( 'Source code (zip)', $html );
	}
}
