<rendering-tables-page>
	<h2 style="margin:0;padding:0">Rendering Tables</h2>
	The following HTML Tables are rendered dynamically using this data:

	<code-display filename="pages/rendering-tables-page.tag" firstline='77' lastline='103'></code-display>

	<h2>Simple Table: 1 display row for 1 data row.</h2>
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
		<tr each={ row, index in rows } onclick={ rowClick }>
			<td>{ index + 1 }</td>
			<td>{row.FIRST}</td>
			<td>{row.LAST}</td>
			<td>{row.PHONE}</td>
			<td>{row.CITY}</td>
			<td>{row.STATE}</td>
			<td>{row.ZIP}</td>
		</tr>
	</table>

	<p>Here's the code that renders the table:</p>

	<code-display filename="pages/rendering-tables-page.tag" firstline='7' lastline='27'></code-display>

	<p>The important bit is...</p>

	<code-embed content="<tr each=\{ row, index in rows \} onclick=\{ rowClick \}>"></code-embed>

	<p>This tells riot to iterate the <b>tr</b> element for each item in the array <b>rows</b>. On every iteration, riot sets the variable <b>row</b> to the current item in the array, and <b>index</b> to the zero-based index of the item in the array.</p>
	<p>Within the body of the <b>TR</b> tag, you can refer to <b>row</b> and <b>index</b> variables, and use the \{ interpolation \} syntax to display them. Read more at <a href="http://riotjs.com/guide/#loops">riotjs.com</a></p>

	<p>See below for an explanation of the <b>onclick</b> handler.</p>

	<h2>Complex Table: 2 display rows for 1 row of data</h2>
	<table class="complex">
		<tbody each={ row, index in rows } onclick={ rowClick }>
			<tr>
				<td>{row.FIRST} {row.LAST} ({row.PHONE})</td>
			</tr>
			<tr class="bottom">
				<td>{row.CITY} {row.STATE}, {row.ZIP}</td>
			</tr>
		</tbody>
	</table>
	<p>This table works almost exactly like the previous one. The difference is that it has <b>TWO TR tags</b> for each item in the array. It looks like this:

	<code-display filename="pages/rendering-tables-page.tag" firstline='44' lastline='50'></code-display>

	<p>You can't put the loop on either of the <b>TR</b> tags. So what do you do? Use the <b>TBODY</b> tag!</p>

	<code-display filename="pages/rendering-tables-page.tag" firstline='43' lastline='51'></code-display>

	<p>A <b>TBODY</b> tag is used to group the body content in an HTML table. So when you add the <b>each</b> loop to the TBODY tag, you're telling riot to repeat both the TR's for each iteration of the loop, which is exactly what you want to do!</p>

	<h2>Clicking a Row -- a simple event handler</h2>
	<p>Riot has a special syntax for dealing with events. In the markup, you specify the name of a function to handle the event. You don't use parenthesis and you don't pass any parameters.</p>

	<p>Remember this line from the Simple Table example?</p>

	<code-embed content="<tr each=\{ row, index in rows \} onclick=\{ rowClick \}>"></code-embed>

	<p>We are telling Riot to call the <b>rowClick</b> function, which is defined in the script tag.</p>

	<code-display filename="pages/rendering-tables-page.tag" firstline='104' lastline='109' lang="js"></code-display>

	<p>You might notice this is a special syntax, too. The event parameter is a "MouseEvent" object. It has a magic property called <b>item</b> that represents the iteration of the loop, so you can access the loop variables in the function. For example, <b>event.item.row.FIRST</b> refers to the "FIRST" property of the object that was clicked. <b>event.item.index</b> refers to the index of the object in the array. For more info about event handler, go to <a href="http://riotjs.com/guide/#event-handlers">riotjs.com</a></p>

<script>
	var thisTag = this;
	thisTag.rows = [
    {
        "FIRST":"Abigal",
        "LAST" : "Andrews",
        "PHONE" : "212-555-1234",
        "CITY":"New York City",
        "STATE": "NY",
        "ZIP": "10003"
    },
    {
        "FIRST":"Benjamin",
        "LAST" : "Button",
        "PHONE" : "862-555-3452",
        "CITY":"South Orange",
        "STATE": "NJ",
        "ZIP": "07079"
    },
    {
        "FIRST":"Cicily",
        "LAST" : "Cooper",
        "PHONE" : "617-555-5321",
        "CITY":"Boston",
        "STATE": "MA",
        "ZIP": "02112"
    }
  ];

  rowClick(event) {
  	var msg = "You clicked on row:" + event.item.index + ", name:" + event.item.row.FIRST + " " + event.item.row.LAST;
  	event.preventDefault(true);
  	alert(msg);
  }

  this.on('mount', function() {
	var el = document.getElementById('display');
    Prism.highlightElement(el);
  })
</script>

<style scoped>
	table.simple td, table th {
		padding:10px;
		text-align: left;
	}

	table.simple tr:nth-child(even) {
		background-color: #eee;
	}

	table.simple tr:hover {
		background-color: #EE0;
		cursor:pointer;
	}

	h2 {
		padding-top:30px;
		padding-bottom:5px;
		margin-bottom:0;
	}

	table.complex td, table th {
		padding: 10px;
		text-align: left;
	}
	table.complex tbody:nth-child(odd) {
		background-color: #eee;
	}
	table.complex tbody:hover {
		background-color: #EE0;
		cursor:pointer;
	}

</style>
</rendering-tables-page>