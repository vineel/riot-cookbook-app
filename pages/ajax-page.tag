<ajax-page>
	<div>
		<p>Most data lives on the server. Most front-end javascript applications have to go get that data and display it for the user.</p>

		<p>There are dozens of libraries and modules to help you do these kinds of queries. This page will use one called <a href="https://github.com/dimitrinicolas/marmottajax">MarmottAjax</a>. It is one of my favorites because it is tiny, easy to use, and employs a promise structure with its syntax. If you don't know what promises are, <a href="http://www.html5rocks.com/en/tutorials/es6/promises/">read about them.</a></p>

		<p>Here is the simple table from the "Rendering Tables" page. However, the data that builds the table is retrieved as JSON from the server, instead of being declared in the script of the tag.</p>

		<table class="simple">
			<tr>
				<th>Index</th>
				<th>First</th>
				<th>Last</th>
				<th>Phone</th>
				<th>City</th>
				<th>State</th>
				<th>Zip</th>
			</tr>
			<tr each={ row, index in rows }>
				<td>{ index + 1 }</td>
				<td>{row.FIRST}</td>
				<td>{row.LAST}</td>
				<td>{row.PHONE}</td>
				<td>{row.CITY}</td>
				<td>{row.STATE}</td>
				<td>{row.ZIP}</td>
			</tr>
		</table>

		<br/>
		<p>Here's the script that retrieves the data from the server:</p>

		<code-display filename='examples/ajax-page.tag' firstline='53' lastline='74' lang='javascript'></code-display>

		<p>
		We start the Ajax query on the <b>'mount'</b> event. Once the mount event is received, we know that the DOM has been loaded into the page. This removes any race conditions from the code. (Bad Race Condition: we get the data, but the DOM hasn't been loaded, so rendering the table fails.)
		</p>

		<p>We create a MarmottAjax request, with the url <a href="/contact-data.json">/contact-data.json</a>. Once the data has been downloaded, the function in the <b>then</b> callback fires.</p>

		<p>In the callback, we parse the JSON textual data into normal javascript data. We also assign this data to a property of the Tag instance:</p>

		<code-embed content="thisTag.rows = JSON.parse(json);" lang='html'></code-embed>

		<p>This makes the <b>rows</b> property accessible from the markup. Finally, we call <b>update()</b> on the tag instance to tell it to redraw itself, rendering the table with data.</p> 

		<code-embed content="thisTag.update();" language="javascript"></code-embed>
		<br>
		<p>The HTML markup is pretty much the same as it was on the <a href="/#/pages/rendering-tables-page">Rendering Tables</a> page.</p>

		<code-display filename='examples/ajax-page.tag' firstline='8' lastline='28'>/code-display>
	</div>

	<script>
		var thisTag = this;
		var marmottAjax = require('marmottajax');

		// we don't ask for the data until the DOM is mounted, so we're sure we can
		// render the table in the DOM when we get the data
		thisTag.on('mount', function() {

			// create a MarmottAjax object with the URL of the data
			marmottAjax({url: 'contact-data.json', method: 'get'})
			.then(function(json) {
				// now we have the textual data in <b>json</b>, 
				// we parse it into real data
				thisTag.rows = JSON.parse(json);

				// then we call update on this tag, so it will draw the table
				thisTag.update();
			})
		});
	</script>

	<style scoped>
		table.simple td, table th {
			padding:10px;
			text-align: left;
		}

		table.simple tr:nth-child(even) {
			background-color: #eee;
		}

	</style>

</ajax-page>