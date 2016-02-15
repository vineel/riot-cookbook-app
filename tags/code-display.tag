<code-display>
	<div class='header' if={ opts.hdr!=undefined }>Filename: { opts.filename }</div>
	<pre class={more_margin: (opts.hdr===undefined) }><code name="display" id="display" class={ language-javascript: lang==='js', language-html: lang==='html' }></code></pre>

	<script>
		var thisTag = this;
		var majax = require('marmottajax');
		var hljs = require('highlight.js');
		var range = null;
		console.log("this.opts.lang",thisTag.opts.lang);
		thisTag.lang = thisTag.opts.lang || "html";

		console.log("thisTag.lang",thisTag.lang);

		thisTag.on('mount', function(text) {
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
				// thisTag.display.innerHTML = text;
				hljs.highlightBlock(thisTag.display);
				thisTag.update(this);
			})
		});

	</script>

	<style scoped>
	div.header {
		font-size:12px;
		font-weight: normal;
		background-color: #aaa;
		color: #fff;
		padding-left:20px;
		margin-top: 10px;
		margin-bottom:0;
		padding-bottom: 0;
	}
	pre {
		margin:0;
		margin-bottom: 20px;
	}
	#display {
		background-color: #f5f2f0;
	}
	.more_margin {
		margin-top: 10px 0 20px 0;
	}

	</style>
</code-display>