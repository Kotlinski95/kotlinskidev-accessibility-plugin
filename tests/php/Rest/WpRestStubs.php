<?php
declare(strict_types=1);

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error {

		public function __construct( public string $code = '', public string $message = '', public mixed $data = '' ) {}
	}
}

if ( ! class_exists( 'WP_REST_Response' ) ) {
	class WP_REST_Response {

		private array $headers = array();

		public function __construct( private mixed $data = null, private int $status = 200 ) {}

		public function get_data(): mixed {
			return $this->data;
		}

		public function get_status(): int {
			return $this->status;
		}

		public function header( string $key, string $value ): void {
			$this->headers[ $key ] = $value;
		}

		public function get_headers(): array {
			return $this->headers;
		}
	}
}

if ( ! class_exists( 'WP_REST_Request' ) ) {
	class WP_REST_Request {

		public function __construct( private mixed $json = null, private array $params = array() ) {}

		public function get_param( string $key ): mixed {
			return $this->params[ $key ] ?? null;
		}

		public function get_json_params(): mixed {
			return $this->json;
		}
	}
}
