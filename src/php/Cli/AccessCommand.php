<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cli;

use Kotlinskidev\A11y\Admin\Access;
use WP_CLI;

final class AccessCommand {

	private Access $access;

	public function __construct( ?Access $access = null ) {
		$this->access = $access ?? new Access();
	}

	public static function register(): void {
		$command = new self();
		$role    = array(
			'type'        => 'positional',
			'name'        => 'role',
			'description' => 'Role name, for example editor.',
		);

		WP_CLI::add_command(
			'ka11y access grant',
			array( $command, 'grant' ),
			array(
				'shortdesc' => 'Let a role customise the widget text, statement, colours and theme mode.',
				'synopsis'  => array( $role ),
			)
		);
		WP_CLI::add_command(
			'ka11y access revoke',
			array( $command, 'revoke' ),
			array(
				'shortdesc' => 'Remove the customer capability from a role.',
				'synopsis'  => array( $role ),
			)
		);
		WP_CLI::add_command(
			'ka11y access list',
			array( $command, 'list_roles' ),
			array(
				'shortdesc' => 'List the roles that hold the customer capability.',
				'synopsis'  => array(
					array(
						'type'        => 'assoc',
						'name'        => 'format',
						'optional'    => true,
						'default'     => 'table',
						'options'     => Output::TABLE_FORMATS,
						'description' => 'Output format.',
					),
				),
			)
		);
	}

	public function grant( array $args ): void {
		$role       = $this->role( $args );
		$capability = $this->access->customer_capability();

		if ( in_array( $role, $this->access->roles(), true ) ) {
			WP_CLI::success( __( 'Already granted:', 'kotlinskidev-accessibility' ) . ' ' . $capability . ' ' . __( 'for role', 'kotlinskidev-accessibility' ) . ' ' . $role . '.' );

			return;
		}

		$this->access->grant( $role );

		WP_CLI::success( __( 'Granted', 'kotlinskidev-accessibility' ) . ' ' . $capability . ' ' . __( 'to role', 'kotlinskidev-accessibility' ) . ' ' . $role . '.' );
	}

	public function revoke( array $args ): void {
		$role       = $this->role( $args );
		$capability = $this->access->customer_capability();

		if ( ! in_array( $role, $this->access->roles(), true ) ) {
			WP_CLI::success( __( 'Not granted:', 'kotlinskidev-accessibility' ) . ' ' . $capability . ' ' . __( 'for role', 'kotlinskidev-accessibility' ) . ' ' . $role . '.' );

			return;
		}

		$this->access->revoke( $role );

		WP_CLI::success( __( 'Revoked', 'kotlinskidev-accessibility' ) . ' ' . $capability . ' ' . __( 'from role', 'kotlinskidev-accessibility' ) . ' ' . $role . '.' );
	}

	public function list_roles( array $args, array $assoc_args ): void {
		$format     = Output::format( $assoc_args, Output::TABLE_FORMATS, 'table' );
		$capability = $this->access->customer_capability();
		$rows       = array_map(
			static fn ( string $role ): array => array(
				'role'       => $role,
				'capability' => $capability,
			),
			$this->access->roles()
		);

		Output::rows( $format, $rows, array( 'role', 'capability' ) );
	}

	private function role( array $args ): string {
		$name = (string) ( $args[0] ?? '' );

		if ( '' === $name || null === get_role( $name ) ) {
			WP_CLI::error( __( 'Unknown role:', 'kotlinskidev-accessibility' ) . ' ' . $name );
		}

		return $name;
	}
}
