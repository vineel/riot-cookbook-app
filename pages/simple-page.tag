<simple-page>
	<div>
	<p>The basic building block of riot is the "tag" -- which is basically a component that combines HTML markup, scripting code, and styling.</p>

	<p>
		A tag can be very simple. For example, here's a custom riot tag called "simple".
	</p>
	<code-display filename="/tags/simple.tag"></code-display>

	<p>
		There are a few things to notice about this tag:
		<ol>
		<li>The name of the tag is <b>simple</b>.</li>
		<li>You can embed this tag in another tag like this:
		<code-embed content="<simple></simple>"></code-embed>
		<li>There is no javascript or CSS in this tag. It is legal to have a markup-only or script-only tag.
		<li>The root element of this tag is <code-embed content="<p>"></code-embed>
		<li>Typically, this tag would be saved in a file called <b>simple.tag</b>.</li>
		</ol>
	</p>
	</div>


	<style scoped>
	li {
		margin-bottom: 20px;
	}
	</style>
</simple-page>