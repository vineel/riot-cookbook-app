<getdom-page>
<h2>There are several ways to refer to an element in the DOM.</h2>
<p>Here's an example of markup from the top of a tag.</p>

<div style="background-color:#eee; padding:0px">
	<h1 id='simulatedRoot'>Some Markup</h1>
	<div name="container">
		<div>
			<p id="item">Text One</p>
		</div>
		<div>
			<p id="content">Text Two</div>
		</div>
	</div>
	<div name="container">
		<p>Text Three</p>
	</div>
</div>
<br>
<code-display filename="examples/getdom-ex1.html"></code-display>

<h3>Access a DOM element by ID or Name attributes</h3>

<p>Note: <b>this</b> is a reference to the tag instance from the <b>&lt;script&gt;</b> area of a tag.</p>

<p>this.item = <code>{ item.toString() }</code></p>
<p>this.item.innerText = <code>{ item.innerText }</code></p>
<p>this.item.innerHTML = <code>{ item.innerHTML }</code></p>
<p>this.content = <code>{ content.toString() }</code></p>
<p>this.container = <code>{ container.toString() }</code></p>
<p>this.container[1].childNodes[1].innerText = <code>{ container[1].childNodes[1].innerText }</code></p>

<h3>Access DOM elements by selectors.</h3>
<p>this.root.querySelector('#content') = <code>{ root1 }</code></p>
<p>this.root.querySelector('#content').innerText = <code>{ root1.innerText }</code></p>

<script>
	var thisTag = this;
	thisTag.root1 = '';
	thisTag.gug = this.container[1];
	thisTag.on('mount', function() {
		thisTag.root1 = thisTag.root.querySelector('#content');
		thisTag.update();
	})
</script>

<style scoped>
	div {
		border: 1px solid black;
	}
	[name=container] {
		display: -ms-flex;
		display: -webkit-flex;
		display: flex;
		padding:0;
		margin:0;
	}
	[name=container] div {
		padding:10px;
	}

</style>
</getdom-page>