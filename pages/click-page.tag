<click-page>
<div>
	<p>Webapps are interactive -- and the most fundamental unit of interactivity is the click. Riot lets your code respond to clicks with the <b>onclick</b> handler. You can read more at <a href="http://riotjs.com/guide/#event-handlers">riotjs</a></p>

	<h2>A Simple Click</h2>

	<p>You can add an <b>onclick</b> event handler to most DOM elements. For example, here's one on an <b>A</b> element.</p>

	<code-embed content="<a onclick=\{ handleMyClick \}>click me</a>" lang='html'></code-embed>

	<p>You write code to handle the click on a function with a special syntax, like this:</p>

	<code-display filename='examples/click-ex1.js' lang="javascript"></code-display>

	<p>Here's the live version:<br>
	<a onclick={ handleMyClick }>click me</a>
	</p>

	<h2>A Click in a Loop</h2>
	<div each={ name in names }>
		<a onclick={ clickFirst }  class="clickable">{name.FIRST}</a>
		<a onclick={ clickLast } class="clickable">{name.LAST}</a>
	</div>
	<p>
	Go ahead and click on a first or last name above. You should see an alert window that shows what you clicked on.
	</p>

	<p>
	The data is defined in the script as JSON:
	</p>

	<code-display filename="/examples/click-ex3.js" language="javascript"></code-display>

	<p>The HTML is rendered with the following markup.</p>

	<code-display filename="/examples/click-ex2.html" lang="html"></code-display>

	<p>The javascript that handles both clicks looks like this:</p>

	<code-display filename="/examples/click-ex4.js" lang="javascript"></code-display>

	<p>The MouseEvent handler <b>event</b> has a property, <b>item</b>, which contains the iteration variable. So... <b>event.item.name.FIRST</b> refers to the first name being rendered or clicked on.</p>

	<h2>A Click with Parameters</h2>
	<p>
		Riot's event handler syntax, <b>onclick=\{ someFn \}</b>, allows only for the function name of the handler. It doesn't allow for any parameters to be sent along with it. This can lead to many redundant event handlers. However, there are a couple useful workarounds.
	</p>

	<h3>Workaround 1: Using another attribute.</h3>
	<p>
		<a data-argument="1" onclick={ handleAction }>Action 1</a><br>
		<a data-argument="2" onclick={ handleAction }>Action 2</a>
	</p>
	<p>You can use a custom attribute in the tag that has the onclick handler. Here, we're using a custom attribute called <b>data-argument</b>.</p>

	<code-display filename='/examples/click-ex5.html' lang='html'></code-display>

	<h3>Workaround 2: Using bind in the event handler.</h3>

	<p>
		<a onclick={ handleAction2.bind(this,"1") }>Action 1</a><br>
		<a onclick={ handleAction2.bind(this,"2") }>Action 2</a>
	</p>
	<p>Here, we bind the call to the function with a parameter value. This parameter is passed to the function instead of the normal MouseEvent.</p>

	<code-display filename='/examples/click-ex6.html' lang='html'></code-display>


	<br>
	<br>
	<br>
	<br>
	<br>
</div>

	<script>
		var thisTag = this;

		handleMyClick(event) {
			console.log(event); // event is a MouseEvent object
			alert("got a click!")
		}

		clickFirst(event) {
			alert("First Name:" + event.item.name.FIRST );
		}

		clickLast(event) {
			alert("Last Name:" + event.item.name.LAST );
		}

		handleAction(event) {
			var param = event.target.attributes['data-argument'].value;
			alert("param was: " + param);
		}

		handleAction2(param) {
			alert("param was: " + param);
		}

		thisTag.names = [{"FIRST":"Abigal","LAST":"Andrews"},{"FIRST":"Benjamin","LAST":"Button"},{"FIRST":"Cicily","LAST":"Cooper"}];
	</script>

	<style scoped>
		table.simple td, table th {
			padding:10px;
			text-align: left;
		}

		table.simple tr:nth-child(odd) {
			background-color: #eee;
		}
		.clickable {
			cursor: pointer;
		}
		.clickable:hover {
			text-decoration: underline;
		}

	</style>

</click-page>