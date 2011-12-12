<?php

$root = dirname( dirname( dirname( dirname( __FILE__ ) ) ) ) . DIRECTORY_SEPARATOR;

require $root . 'dbconnect.php';
include $root . 'includes/functions.php';
include $root . 'includes/clientfunctions.php';
include $root . 'includes/modulefunctions.php';
include $root . 'includes/gatewayfunctions.php';
include $root . 'includes/ccfunctions.php';
include $root . 'includes/processinvoices.php';
include $root . 'includes/invoicefunctions.php';
include $root . 'includes/backupfunctions.php';
include $root . 'includes/ticketfunctions.php';
include $root . 'includes/currencyfunctions.php';
@ini_set( 'memory_limit', '512M' );
@ini_set( 'max_execution_time', 0 );
@set_time_limit( 0 );

getOnAppUsersStatistic();

function getOnAppUsersStatistic() {
	global $root;
	require_once $root . 'modules/servers/onappusers/onappusers.php';
	require_once dirname( __FILE__ ) . '/includes/php/CURL.php';

	$clients_query = 'SELECT
			tblonappusers.server_id,
			tblonappusers.client_id,
			tblonappusers.onapp_user_id,
			tblhosting.paymentmethod,
			tblhosting.domain,
			tblproducts.tax,
			tblclients.taxexempt,
			tblclients.state,
			tblclients.country,
			tblhosting.id AS service_id,
			tblproducts.name AS packagename
		FROM
			tblonappusers
			LEFT JOIN tblhosting ON
				tblhosting.userid = tblonappusers.client_id
				AND tblhosting.server = tblonappusers.server_id
			LEFT JOIN tblproducts ON
				tblhosting.packageid = tblproducts.id
				AND tblproducts.servertype = "onappusers"
			LEFT JOIN tblclients ON
				tblclients.id = tblonappusers.client_id
		WHERE
			tblhosting.domainstatus IN ( "Active", "Suspended" )
			AND tblproducts.name IS NOT NULL';
	$clients_result = full_query( $clients_query );

	$servers_query = 'SELECT
			id,
			ipaddress,
			username,
			password
		FROM
			tblservers
		WHERE
			type = "onappusers"';
	$servers_result = full_query( $servers_query );
	$servers = array();
	while( $server = mysql_fetch_assoc( $servers_result ) ) {
		$server[ 'password' ] = decrypt( $server[ 'password' ] );
		$servers[ $server[ 'id' ] ] = $server;
	}
	$log = 'SERVERS: ' . PHP_EOL . print_r( $servers, true );

	$date = date( 'Y-m-d H:00:00', time() - 3600 );
	$data_url = array(
		urlencode( 'period[startdate]' ) . '=' . $date,
		urlencode( 'period[enddate]' ) . '=' . $date,
		urlencode( 'period[use_local_time]' ) . '=1',
	);
	$data_url = implode( '&', $data_url );

	$headers = array( 'Accept: application/json', 'Content-type: application/json' );
	while( $client = mysql_fetch_assoc( $clients_result ) ) {
		$url = $servers[ $client[ 'server_id' ] ][ 'ipaddress' ] . '/users/' . $client[ 'onapp_user_id' ] . '/vm_stats.json?' . $data_url;

		$curl = new CURL( );
		$curl->addOption( CURLOPT_USERPWD, $servers[ $client[ 'server_id' ] ][ 'username' ] . ':' . $servers[ $client[ 'server_id' ] ][ 'password' ] );
		$curl->addOption( CURLOPT_HTTPHEADER, $headers );
		$curl->addOption( CURLOPT_HEADER, true );
		$data = $curl->get( $url );

		$data = json_decode( $data, true );

		// process data
		$sql = array();
		foreach( $data as $stat ) {
			$tmp = array();
			$tmp[ 'server_id' ] = $client[ 'server_id' ];
			$tmp[ 'whmcs_user_id' ] = $client[ 'client_id' ];
			$tmp[ 'date' ] = $stat[ 'vm_stats' ][ 'created_at' ];
			$tmp[ 'id' ] = $stat[ 'vm_stats' ][ 'id' ];
			$tmp[ 'usage_cost' ] = $stat[ 'vm_stats' ][ 'usage_cost' ];
			$tmp[ 'total_cost' ] = $stat[ 'vm_stats' ][ 'total_cost' ];
			$tmp[ 'onapp_user_id' ] = $stat[ 'vm_stats' ][ 'user_id' ];
			$tmp[ 'currency' ] = $stat[ 'vm_stats' ][ 'currency_code' ];
			$tmp[ 'vm_id' ] = $stat[ 'vm_stats' ][ 'virtual_machine_id' ];
			$tmp[ 'vm_resources_cost' ] = $stat[ 'vm_stats' ][ 'vm_resources_cost' ];

			foreach( $stat[ 'vm_stats' ][ 'billing_stats' ] as $name => $V ) {
				if( ( $name == 'virtual_machines' ) ) {
					if( is_null( $tmp[ 'vm_id' ] ) ) {
						$tmp[ 'vm_id' ] = $V[ 0 ][ 'id' ];
					}
				}

				foreach( $V as $value ) {
					$sql_tmp = 'INSERT INTO `onapp_itemized_' . $name . '` SET stat_id = ' . $tmp[ 'id' ] . ', id = ' . $value[ 'id' ];
					foreach( $value[ 'costs' ] as $v ) {
						$sql_tmp .= ', ' . $v[ 'resource_name' ] . ' = ' . $v[ 'value' ];
						$sql_tmp .= ', ' . $v[ 'resource_name' ] . '_cost = ' . $v[ 'cost' ];
					}
					$sql_tmp .= ', label = "' . $value[ 'label' ] . '"';
					$sql[] = $sql_tmp;
				}
			}

			$cols = implode( ', ', array_keys( $tmp ) );
			$values = implode( '", "', array_values( $tmp ) );
			$sql_tmp = 'INSERT INTO `onapp_itemized_stat` ( ' . $cols . ' ) VALUES ( "' . $values . '" )';
			$sql[] = $sql_tmp;
		}

		// process SQL
		foreach( $sql as $record ) {
			print_r(full_query( $record ));
		}
	}
}