<code-display>
	<div>
	<div style="width:100%">
	<h1>Filename: { opts.filename }</h1>
	<pre><code name="display" id="display" class="language-markup"></code></pre>
	</div>
	</div>

	<script>
		var thisTag = this;
		var majax = require('marmottajax');
		var range = null;
		

		thisTag.on('mount', function(text) {
			console.log("check 2");
			majax({
				url: thisTag.opts.filename,
				method: 'get'
			}).then(function(text) {
				if (thisTag.opts.firstline) {
					var firstLine = parseInt(thisTag.opts.firstline);
					var lastLine = parseInt(thisTag.opts.lastline);
					text = text.split("\n").slice(firstLine, lastLine).join("\n");
				}
				thisTag.text = text;
				thisTag.display.innerText = text;
				var el = document.getElementById('display');
		        Prism.highlightElement(el);
				thisTag.update(this);
			})
		});

	</script>

	<style scoped>
	h1 {
		font-size:12px;
		font-weight: normal;
		margin:0;
		padding:0;
	}
	pre, code {
		margin:0;
		padding:0;
	}
	</style>
</code-display>