$( document ).ready( function() {
	$( '#stat_data div' ).hide();

	$( '#stat-nav a' ).click( function() {
		$( '#stat-nav a' ).removeClass( 'stat-nav-bold' );
		$( this ).addClass( 'stat-nav-bold' );
		$( '#stat_data div' ).hide();
		$( '#stat_data div#stat-' + $( this ).attr( 'rel' ) ).show();
		$( '#stat-pages' ).show();
		if( $( this ).attr( 'rel' ) === 'resources' ) {
			$( '#stat-pages' ).hide();
		}
		return false;
	} );

	$( '#stat-pages select' ).live( 'change', function () {
		page = $( this ).val();
		$( 'input#get-stat' ).click();
	} );

	var now = new Date();
	var end = now.getFullYear() + '-';
	end += ( ( now.getMonth() < 9 ) ? '0' + ( now.getMonth() + 1 ) : ( now.getMonth() + 1 ) ) + '-';
	end += ( now.getDate() < 10 ) ? '0' + now.getDate() : now.getDate();
	now.setDate( now.getDate() - 7 );

	var hr = now.getHours();
	if( hr < 10 ) {
		hr = '0' + hr;
	}

	var start = now.getFullYear() + '-';
	start += ( ( now.getMonth() < 9 ) ? '0' + ( now.getMonth() + 1 ) : ( now.getMonth() + 1 ) ) + '-';
	start += ( now.getDate() < 10 ) ? '0' + now.getDate() : now.getDate();
	$( 'input#start' ).val( start );
	$( 'input#end' ).val( end );

	var PGN = false;
	$( 'input#get-stat' ).bind( 'click', function() {
		$( 'span#loading' ).css( 'visibility', 'visible' );
		if( PGN ) {
			PGN = false;
		}
		else {
			page = 1;
		}

		$.ajax( {
			url: document.location.href,
			data: {
				getstat: 1,
				modop: 'custom',
				ac: 'OutstandingDetails',
				start: $( 'input#start' ).val() + ' ' + $( 'select#start-time' ).val() + ':00:00',
				end: $( 'input#end' ).val() + ' ' + $( 'select#end-time' ).val() + ':00:00',
				page: page,
				tz_offset: function() {
					if( $( '#use-tz input' ).attr( 'checked' ) ) {
						var myDate = new Date();
						offset = myDate.getTimezoneOffset();
					}
					else {
						offset = 0;
					}
					return offset;
				},
				id: PID
			},
			success: function( data ) {
				data = jQuery.evalJSON( data );
				processData( data );
				processPGN( data );
				$( 'span#loading' ).css( 'visibility', 'hidden' );
				$( 'a.stat-nav-bold' ).click();
			}
		} );
	} );

	$( '.sel_imul' ).live( 'click', function () {
		$( '.sel_imul' ).removeClass( 'act' );
		$( this ).addClass( 'act' );

		if( $( this ).children( '.sel_options' ).is( ':visible' ) ) {
			$( '.sel_options' ).hide();
		}
		else {
			$( '.sel_options' ).hide();
			$( this ).children( '.sel_options' ).show();
		}
	} );


	$( '.sel_option' ).live( 'click', function () {
		var tektext = $( this ).html();
		$( this ).parent( '.sel_options' ).parent( '.sel_imul' ).children( '.sel_selected' ).children( '.selected-text' ).html( tektext );

		$( this ).parent( '.sel_options' ).children( '.sel_option' ).removeClass( 'sel_ed' );
		$( this ).addClass( 'sel_ed' );

		var tekval = $( this ).attr( 'value' );
		tekval = typeof(tekval) != 'undefined' ? tekval : tektext;
		var select = $( this ).parent( '.sel_options' ).parent( '.sel_imul' ).parent( '.sel_wrap' ).children( 'select' );
		select.children( 'option' ).removeAttr( 'selected' ).each( function () {
			if( $( this ).val() == tekval ) {
				$( this ).attr( 'selected', 'select' );
			}
		} );
		if( select.attr( 'rel' ) == 'pages' ) {
			if( tekval != page ) {
				PGN = true;
				$( '#stat-pages select' ).change();
			}
		}
	} );

	// timepicker blur
	var selenter = false;
	$( '.sel_imul' ).live( 'mouseenter', function () {
		selenter = true;
	} );
	$( '.sel_imul' ).live( 'mouseleave', function () {
		selenter = false;
		$( document ).click();
	} );
	$( document ).click( function () {
		if( !selenter ) {
			$( '.sel_options' ).hide();
			$( '.sel_imul' ).removeClass( 'act' );
		}
	} );

	$( "#end" ).datepicker( { dateFormat:'yy-mm-dd' } );
	$( "#start" ).datepicker( { dateFormat:'yy-mm-dd' } );

	reselect( '#start-time', 'sec overf' );
	reselect( '#end-time', 'sec overf' );
	var INT = setInterval( function () {
		if( $( 'div.sel_option' ).length = 48 ) {
			$( 'div.sel_option[value="' + hr + '"]' ).click();
			clearInterval( INT );
			$( 'input#get-stat' ).click();
		}
	}, 2 );
} );

function processData( data ) {
	total = number_format( data.total_amount, 2, '.', ' ' );
	var resources = data.resources;

	data = data.stat;
	$( 'div[id^="stat-"]' ).hide();
	$( '#stat-warning' ).remove();
	if( data.length == 0 ) {
		var html = '<tr id="stat-warning"><td style="text-align: center; font-weight: bold;">' + LANG.onappusersstatnodata + '</td></tr>';
		$( '#stat-nav' ).hide();
		$( '#stat_data' ).hide();
		$( 'table.userstat tr:first' ).after( html );
		return;
	}

	var CUR = LANG.onappusersstatcurrency;
	var table_vms = $( 'div#stat-vms tr:first' );
	var table_disks = $( 'div#stat-disks tr:first' );
	var table_nets = $( 'div#stat-nets tr:first' );
	table_vms.nextAll().remove();
	table_disks.nextAll().remove();
	table_nets.nextAll().remove();

	//var total = 0;
	var html_vms = '';
	var html_disks = '';
	var html_nets = '';
	var cost_vm = cost_disk = cost_net = 0;
	for( i in data ) {
		tmp = data[ i ];
		var date = tmp.date.substr( 0, 16 );

		// process vm
		cst = parseFloat( tmp.cpus_cost ) + parseFloat( tmp.cpu_shares_cost ) + parseFloat( tmp.cpu_usage_cost ) + parseFloat( tmp.memory_cost ) + parseFloat( tmp.template_cost );
		cost_vm += cst;

		var currency = CUR[ tmp.currency ] ? CUR[ tmp.currency ] : tmp.currency;

		html_vms += '<tr>';
		html_vms += '<td>' + date + '</td>';
		html_vms += '<td>' + tmp.label + '</td>';
		html_vms += '<td>' + tmp.cpus + ' ' + currency + number_format( tmp.cpus_cost, 2, '.', ' ' ) + '</td>';
		html_vms += '<td>' + tmp.cpu_shares + '% ' + currency + number_format( tmp.cpu_shares_cost, 2, '.', ' ' ) + '</td>';
		html_vms += '<td>' + tmp.cpu_usage + ' ' + currency + number_format( tmp.cpu_usage_cost, 2, '.', ' ' ) + '</td>';
		html_vms += '<td>' + tmp.memory + 'MB ' + currency + number_format( tmp.memory_cost, 2, '.', ' ' ) + '</td>';
		html_vms += '<td>' + tmp.template + ' ' + currency + number_format( tmp.template_cost, 2, '.', ' ' ) + '</td>';
		html_vms += '<td>' + currency + cst.toFixed( 2 ) + '</td>';
		html_vms += '</tr>';

		// process disks
		html_disks += '<tr>';
		html_disks += '<td>' + date + '</td>';
		html_disks += '<td>' + tmp.label + '</td>';

		var size = dr = dw = rc = wc = cst_td = '';
		for( j in tmp.stat.disks ) {
			if( j > 0 ) {
				size += '<br/>';
				dr += '<br/>';
				dw += '<br/>';
				rc += '<br/>';
				wc += '<br/>';
				cst_td += '<br/>';
			}

			var d = tmp.stat.disks[ j ];
			var cst = parseFloat( d.disk_size_cost ) + parseFloat( d.data_read_cost ) + parseFloat( d.data_written_cost ) + parseFloat( d.reads_completed_cost ) + parseFloat( d.writes_completed_cost );
			size += d.label + ' ' + d.disk_size + 'GB ' + currency + number_format( d.disk_size_cost, 2, '.', ' ' );
			dr += d.data_read + ' ' + currency + number_format( d.data_read_cost, 2, '.', ' ' );
			dw += d.data_written + ' ' + currency + number_format( d.data_written_cost, 2, '.', ' ' );
			rc += d.reads_completed + ' ' + currency + number_format( d.reads_completed_cost, 2, '.', ' ' );
			wc += d.writes_completed + ' ' + currency + number_format( d.writes_completed_cost, 2, '.', ' ' );
			cost_disk += cst;
			cst_td += currency + number_format( cst, 2, '.', ' ' );
		}
		html_disks += '<td>' + size + '</td>';
		html_disks += '<td>' + dr + '</td>';
		html_disks += '<td>' + dw + '</td>';
		html_disks += '<td>' + rc + '</td>';
		html_disks += '<td>' + wc + '</td>';
		html_disks += '<td>' + cst_td + '</td>';
		html_disks += '</tr>';

		// process nets
		html_nets += '<tr>';
		html_nets += '<td>' + date + '</td>';
		html_nets += '<td>' + tmp.label + '</td>';

		var int = dr = ds = rate = cst_td = '';
		for( j in tmp.stat.nets ) {
			if( j > 0 ) {
				int += '<br/>';
				dr += '<br/>';
				ds += '<br/>';
				rate += '<br/>';
				cst_td += '<br/>';
			}

			var d = tmp.stat.nets[ j ];
			var cst = parseFloat( d.ip_addresses_cost ) + parseFloat( d.data_received_cost ) + parseFloat( d.data_sent_cost ) + parseFloat( d.rate_cost );
			int += d.label + ' ' + d.ip_addresses + ' ' + LANG.onappusersstatnet_ips + ' ' + currency + number_format( d.ip_addresses_cost, 2, '.', ' ' );
			dr += d.data_received + ' ' + currency + number_format( d.data_received_cost, 2, '.', ' ' );
			ds += d.data_sent + ' ' + currency + number_format( d.data_sent_cost, 2, '.', ' ' );
			rate += d.rate + ' ' + currency + number_format( d.rate_cost, 2, '.', ' ' );
			cost_net += cst;
			cst_td += currency + number_format( cst, 2, '.', ' ' );
		}
		html_nets += '<td>' + int + '</td>';
		html_nets += '<td>' + rate + '</td>';
		html_nets += '<td>' + dr + '</td>';
		html_nets += '<td>' + ds + '</td>';
		html_nets += '<td>' + cst_td + '</td>';
		html_nets += '</tr>';
	}

	table_vms.after( html_vms );
	table_disks.after( html_disks );
	table_nets.after( html_nets );

	// process used resources stat
	var j = 0;
	for( i in resources ) {
		$( 'div#stat-resources tr' ).eq( j ++ ).children().eq( 1 ).html( currency + number_format( resources[ i ], 5, '.', ' ' ) );
	}
	$( 'div#stat-resources tr td:first' ).css( 'width', 200 );

	$( '#stat-nav' ).show();
	$( 'div#stat-' + $( '#stat-nav a.stat-nav-bold' ).attr( 'rel' ) ).show();
	$( '#stat_data div' ).width( $( 'tr.stat-labels:first' ).width() - 1 );

	$( '#stat_data' ).show();
}

function processPGN( data ) {
	$( '#stat-pages' ).hide();
	var pages = Math.ceil( data.total / data.limit );

	if( pages <= 1 ) {
		return;
	}

	var nav = '';
	for( i = 1; i <= pages; ++i ) {
		nav += '<option value="' + i + '">' + i + '</option>';
	}

	var select = $( '#stat-pages div:first select' );
	$( '#stat-pages div:first span' ).html( '' );
	$( '#stat-pages div:first span' ).append( select );

	// fill nav divs
	var txt = data.total + ' ' + LANG.onappusersstatrecordsfound + ' ' + LANG.onappusersstatcurrentpage + ' ' + page + ' ' + LANG.onappusersstatcurrentpageof + ' ' + pages;
	$( 'div.taleft' ).text( txt );
	var html = '';
	if( page > 1 ) {
		html += '<a href="' + ( page - 1 ) + '">' + LANG.previouspage + '</a>';
	}
	else {
		html += '<span class="disabled">' + LANG.previouspage + '</span>';
	}
	html += ' | ';
	if( page < pages ) {
		html += '<a href="' + ( page * 1 + 1 ) + '">' + LANG.nextpage + '</a>';
	}
	else {
		html += '<span class="disabled">' + LANG.nextpage + '</span>';
	}

	$( 'div.tacenter' ).html( html );
	$( '#stat-pages select' ).html( nav );

	$( '#stat-pages select' ).val( data.page );
	$( '#stat-pages' ).show();

	// align nav divs
	if( !$( 'div.taleft' ).attr( 'fixed' ) ) {
		$( 'div.taleft' ).width( $( 'div.taleft' ).width() + 20 );
		$( 'div.taright' ).width( $( 'div.taright' ).width() + 5 );
		var w = $( '#stat-pages' ).width() - $( 'div.taleft' ).width() - $( 'div.taright' ).width();
		$( 'div.tacenter' ).width( w );
		$( 'div.taleft' ).attr( 'fixed', true );
	}

	reselect( '#stat-pages select', 'sec overf' );
	var INT = setInterval( function () {
		if( $( '#stat-pages div.sel_option' ).length ) {
			$( '#stat-pages div.sel_option[value="' + $( '#stat-pages select' ).val() + '"]' ).click();
			clearInterval( INT );
		}
	}, 2 );

	$( 'div.tacenter a' ).live( 'click', function() {
		var p = $( this ).attr( 'href' );
		$( '#stat-pages div.sel_option[value="' + p + '"]' ).click();

		return false;
	} );
}

function number_format( number, decimals, dec_point, thousands_sep ) {
	// Strip all characters but numerical ones.
	number = (number + '').replace( /[^0-9+\-Ee.]/g, '' );
	var n = !isFinite( +number ) ? 0 : +number,
			prec = !isFinite( +decimals ) ? 0 : Math.abs( decimals ),
			sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep,
			dec = (typeof dec_point === 'undefined') ? '.' : dec_point,
			s = '',
			toFixedFix = function ( n, prec ) {
				var k = Math.pow( 10, prec );
				return '' + Math.round( n * k ) / k;
			};
	// Fix for IE parseFloat(0.55).toFixed(0) = 0;
	s = (prec ? toFixedFix( n, prec ) : '' + Math.round( n )).split( '.' );
	if( s[0].length > 3 ) {
		s[0] = s[0].replace( /\B(?=(?:\d{3})+(?!\d))/g, sep );
	}
	if( (s[1] || '').length < prec ) {
		s[1] = s[1] || '';
		s[1] += new Array( prec - s[1].length + 1 ).join( '0' );
	}
	return s.join( dec );
}

function reselect( select, addclass ) {
	addclass = typeof(addclass) != 'undefined' ? addclass : '';

	$( select ).wrap( '<div class="sel_wrap ' + addclass + '"/>' );

	var sel_options = '';
	$( select ).children( 'option' ).each( function () {
		sel_options = sel_options + '<div class="sel_option" value="' + $( this ).val() + '">' + $( this ).html() + '</div>';

	} );

	var sel_imul = '<div class="sel_imul">\
                <div class="sel_selected">\
                    <div class="selected-text">' + $( select ).children( 'option' ).first().html() + '</div>\
                    <div class="sel_arraw"></div>\
                </div>\
                <div class="sel_options">' + sel_options + '</div>\
            </div>';

	$( select ).before( sel_imul );
}