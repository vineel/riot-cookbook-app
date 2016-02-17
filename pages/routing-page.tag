<routing-page>
<div>
<p>
Routing is a concept based on the idea that the web is a collection of pages. A unique URL brings the user to a unique page. For example, the url <b>http://www.mywebsite.com/articles/how-to-fly</b> would bring you to a page that featured an article about flying.
</p>

<p>
When developing a single-page app, this idea becomes more challenging to implement. 
<ul>
<li>The page is served once, from a single URL.</li>
<li>The URL must change, without actually changing the page.</li>
<li>The app must react to the new URL and configure the page to show unique content.</li>
<li>The app must be able to navigate by changing it's own URL.</li>
</ul>
This process is called <b>routing</b>.
</p>

<p>
	There are many ways to implement routing using Riot. This app is an example of one very simple solution.
</p>

<h3>A Simple Routing Solution</h3>
 
<p>Here is a diagram of this app and the page you are currently reading:<br>
<img src="routing_diagram.svg"><br>
</p>

<div style="background-color:#f5f2f0;padding:20px">
<h3 style="padding:0;margin:0">Summary of Routing Solution</h3>
<ol>
<li>The <b>menu tag</b> has buttons to change the location to specific URLs. For example:
<ul>
<li>http://localhost:3000/#/pages/simple-page</li>
<li>http://localhost:3000/#/pages/boilerplate-page</li>
<li>http://localhost:3000/#/pages/routing-page</li>
</ul>
</li>

<li>
	Each URL refers to a riot tag: simple-page, boilerplate-tag, routing-page. Each tag contains a page of content. <br/>(These tags are defined in the files in the <b>pages/</b> directory.)
</li>

<li>
	We define a callback in the app tag to be called whenever the URL changes.
</li>
<li>
	The callback instantiates a tag based on the tag name in the URL, and inserts it into the DOM under the <b>content div</b>.
</li>

</ol>
</div>

<h3>Details of Routing Solution</h3>

<p>The outermost entity is the web page <b>index.html</b>. This page embeds the <b>app tag</b>.</p>

<code-embed content="<app></app>" lang='html'></code-embed>

<p>The app tag contains the <b>menu tag</b> and a div with the id <b>content</b>. </p>

<code-display filename="/examples/app.tag" firstline='1' lastline='10' lang="html"></code-display>

<p>The user clicks on a menu button such as <b>Routing</b>. That calls on riot's <b>router</b> to change the URL.</p>

<pre><code id='example1' class="language-javascript">riot.route("/pages/" + e.item.choice[1]); // e.item.choice[1] is a tag name, like "routing-page"
</code></pre>


<p>The <b>app tag</b> contains javascript code that reacts to changes in the URL.</p>

<code-display filename="/examples/app.tag" firstline='29' lastline='39' lang='javascript'></code-display>

<p>
	First, we tell riot to add a URL pattern to the <b>router</b> object that will capture any URL that starts with <b>/pages/</b>. 
</p>
<code-embed content="riot.route('/pages/*', function(tagName) {" lang='javascript'></code-embed>
<p>
	This pattern, with the callback, is called a <b>route</b>. You can add multiple routes. The first route, in order, that fits the URL pattern will be captured.
</p>

<p>When the URL is captured, riot will automagically process it and set the variable <b>tagName</b> to the value of the wildcard match on <b>*</b>. So for this URL:</p>

<code-embed content="http://localhost:3000/#/pages/routing-page" lang='none'></code-embed>

<p>The function will be called with <b>tagName = "routing-page"</b>. The next line...</p>

<code-embed content="riot.mount(thisTag.content, tagName, null )" lang='javascript'></code-embed>

<p>... does the following...
<ol>
<li>Instantiates the tag called "routing-page". This is found in the file <b>pages/routing-page.tag</b></li>
<li>It adds the new instance of the tag to the DOM under the element <b>thisTag.content</b>.
This is the div with the id='content' in the markup above</li>
<li>We do not send any optional parameters to the new tag. If we did, we would change the <b>null</b> to a key-value object.</li>
</ol>
</p>

<p>
	The last line...
</p>
<code-embed content="thisTag.tags.menu.selectByTag(tagName);" lang='javascript'></code-embed>

<p>
	Calls a function in the <b>menu tag</b> that hilites the <b>Routing</b> button.
</p>

<h3>A Last Detail</h3>

<p>
Every website has a "default" URL, that contains just the hostname. For example:
</p>

<code-embed content="http://localhost:3000" lang='javascript'></code-embed>

<p>
One way to deal with this is to capture this URL and redirect the user to a different route.
</p>

<code-display filename="/examples/app.tag" firstline='25' lastline='29' lang='javascript'></code-display>

<p>
This new route captures the default URL, and redirects the user to the overview page.
</p>
</div>

<style scoped>
img {
	margin:20px 0;
	padding:0;
	background-color: green;
}
#example1 {
	background-color: #f5f2f0;
}
</style>

<script>
	var thisTag = this;
	var hljs = require('highlight.js');

	this.on('mount', function() {
		hljs.highlightBlock(thisTag.example1);
	});
</script>
</routing-page>
