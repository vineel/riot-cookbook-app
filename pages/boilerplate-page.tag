<boilerplate-page>
	<div>
		<p>
		Sometimes I use a boilerplate to get a new tag started.
		</p>
		<p>My boilerplate looks like this:</p>
		<code-display filename="/tags/boilerplate.tag"></code-display>
		</p>

		<p>
		Below is what it looks like when you embed it with <b>&lt;boilerplate&gt;&lt;/boilerplate&gt;</b></p>
		<boilerplate></boilerplate>

		<p>
		Here are a few things to notice about this tag:
		<ol>
			<li>The name of this tag is <b>boilerplate</b>. When creating a new tag, you could copy/paste this into a new file. For example, change <b>&lt;boilerplate&gt;&lt;/boilerplate&gt;</b> to <b>&lt;my-tag&gt;&lt;/my-tag&gt;</b> and save the file to <b>"tags/my-tag.tag"</b>. Remember to add it to the file <b>browserify_entrypoint.js</b> so it gets bundled into the app.</li>
			
			<li>The root HTML element of this tag is the <b>&lt;div&gt;</b>. This can be any HTML tag that you like. In a script-only tag, you can leave it out altogether.</li>

			<li>Within the markup area, you can display tag properties using curly brackets.
			<code-embed content="\{ a_tag_variable \}"></code-embed>
			In the script section, you can declare and assign a property of the script like this: 
			<code-embed content="this.a_tag_variable = 'A Lovely Value'"></code-embed>

			<li>The <b>&lt;script&gt;&lt;/script&gt;</b> tags are optional -- you can leave them out and just start writing your javascript. However, I usually use them, because it signals my text editor to use syntax-coloring on the Javascript code, which is nice.</li>

			<li>
				The line... <code-embed content="var thisTag = this;"></code-embed> simply keeps a reference to the tag instance around in the <b>thisTag</b> variable. There are several contexts (promises, callbacks, event handlers, etc.) which change the value of the <b>this</b> variable. It is one of the only tricky things when working with riot. I use <b>thisTag</b> exclusively when I want to refer to the tag instance, which reduces that confusion. (This is a variation on using <code>self = this</code>., which is a common javascript idiom.) I find this simplifies things, but it's definitely your call.
			</li>

			<li>
				When the javascript starts executing in the tag, the DOM elements in the markup have not yet been created. This means you can't change or manipulate the DOM at that point. Instead, DOM-dependent code should go inside the <b>mount</b> event handler. This code will run only <b>after</b> the DOM has been created.
			</li>

			<li>The <b>&lt;style&gt;&lt;/style&gt;</b> tag has a <b>scoped</b> attribute. This tells riot to apply the styles only to the markup in this tag, and tags embedded within it.</li>

			<li>If you leave out the <b>scoped</b> keyword, riot will copy the styles to the global stylesheet. It will apply to the entire page and all the tags contained within.</li>
		</ol>
		</p>
	</div>

	<script>
		var thisTag = this;

		thisTag.on('mount', function() {
			thisTag.a_tag_variable = "DOM is ready now!";
		});
	</script>

</boilerplate-page>