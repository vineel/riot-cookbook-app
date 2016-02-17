<between-page>
	<div>
		<p>In most apps, tag instances have to communicate to get work done. Here's a very simple example.</p>

		<h2>Mechanism 1: Directly calling a method on a Tag Instance</h2>

		<traffic-light-direct id="trafficA"></traffic-light-direct>
		<a onclick={ nextLight1 } light-id='trafficA'>Next</a>

		<br>
		<br>

		<traffic-light-direct id="trafficB"></traffic-light-direct>
		<a onclick={ nextLight1 } light-id='trafficB'>Next</a>
		<br><br>
		<a onclick={ nextOnAll }>Call Next on All</a>

		<h3>How It Works</h3>
		<ul>
			<li>Above we have 2 instances of the <b>traffic-light-direct</b> tag.</li>
			<li>Each has a distinct id, <b>trafficA</b> and <b>trafficB</b>.</li>
			<li>Each has a <b>Next</b> button, which calls the local event handler <b>nextLight1</b></li>
			<li>The event handler finds the correct tag instance based on the ID, and calls the tag's <b>next()</b> method directly on it.<br>
			<B>Markup</B>
			<code-display filename='examples/between-ex1.html' lang='html'></code-display>

			<b>Code</b>
			<code-display filename='examples/between-ex2.js' lang='javascript'></code-display>		
			</li>

			<li>The <b>traffic-light-direct</b> tag, of course, exposes its <b>next</b> method.
			<code-display filename='examples/between-ex3.js' lang='html'></code-display></li>


			<li>There is also a <b>Call Next on All</b> link, which calls the <b>nextOnAll</b> handler.</li>

			<B>Markup</B>
			<code-display filename='examples/between-ex3.html' lang='html'></code-display>

			<b>Code</b>
			<code-display filename='examples/between-ex4.js' lang='javascript'></code-display>		
			</li>


		</ul>
		<br>

		<h2>Mechanism 2: Sending a Notification</h2>
	
		<traffic-light-notify id="trafficC"></traffic-light-notify>
		<a onclick={ nextLight2 } light-id='trafficC'>Next</a>
		<br>
		<br>

		<traffic-light-notify id="trafficD"></traffic-light-notify>
		<a onclick={ nextLight2 } light-id='trafficD'>Next</a> 
		<br>
		<br>
		<a onclick={ nextOnAll2 }>Call Next on All</a>

		<h3>How It Works</h3>
		<ul>
			<li>In the <b>between-page</b> tag, we define an object called <b>notificationCenter</b>.
			<ul><li>It uses <a href="http://riotjs.com/api/observable/">riot's observable()</a> system to send messages throughout the app.</li>
			<li>We also use <a href="http://riotjs.com/guide/#mixins">riot's mixin</a> system to share this object throughout the app.
			<code-display filename='examples/between-ex6.js' lang='javascript'></code-display>	

			</li>
			</ul></li>

			<li>Above we have 2 instances of the <b>traffic-light-notify</b> tag.</li>
			<li>Each has a distinct id, <b>trafficC</b> and <b>trafficD</b>.</li>
			<li>Each has a <b>Next</b> button, which calls the local event handler <b>nextLight2</b></li>
			<li>The event handler uses <b>notificationCenter</b> to send a message called 'next_light_state' with the traffic tag ID as a parameter.<br>
			<B>Markup</B>
			<code-display filename='examples/between-ex8.html' lang='html'></code-display>

			<b>Code</b>
			<code-display filename='examples/between-ex9.js' lang='javascript'></code-display>		
			</li>

			<li>The <b>traffic-light-notify</b> tag has grabbed access to the notificationCenter and registered a listener for the 'next_light_state' message. If there is a tagId sent, it will make sure it has the correct ID before executing.
			<code-display filename='examples/between-ex10.js' language='javascript'></code-display>
			</li>

			<li>There is also a <b>Call Next on All</b> link, which calls the <b>nextOnAll2</b> handler. This handler simply sends the 'next_light_state' message to all listeners, without restricting to a certain tag ID.</li>

			<B>Markup</B>
			<code-display filename='examples/between-ex11.html' lang='html'></code-display>

			<b>Code</b>
			<code-display filename='examples/between-ex12.js' lang='javascript'></code-display>			

			</li>

		</ul>
	</div>

	<script>
		var thisTag = this;

	    var notificationCenter = {
	      notifications: riot.observable(),
	      listenTo: function (eventStr, eventFn) {
	        this.notifications.on(eventStr, eventFn);
	      },
	      send: function(eventStr, p1, p2, p3) {
	        this.notifications.trigger(eventStr, p1, p2, p3);
	      }
	    };
	    riot.mixin("notificationcenter", notificationCenter);

	    // event handler for 'NEXT' link in Mechanism 1
	    nextLight1(e) {
	    	// get ID of traffic light from tag attribute (see Clicking page)
	    	var lightId = e.target.attributes['light-id'].value;

	    	// find the traffic-light-direct tag instance with the correct ID
	    	var targetTraffic = thisTag.tags['traffic-light-direct'].filter(function(r) {
	    		 return r.opts.id == lightId;}
	    	)[0];

	    	if (targetTraffic) {
	    		// call the next() method directly on it
	    		targetTraffic.next();
	    	}
	    }

	    nextOnAll(e) {
	    	// loop through each traffic-light-direct tag instance
	    	thisTag.tags['traffic-light-direct'].forEach(function(light) {
	    		// call next method directly on each tag instance
	    		light.next();
	    	})
	    }

	    nextLight2(e) {
	    	var lightId = e.target.attributes['light-id'].value;
	    	notificationCenter.send('next_light_state', lightId);
	    }
	    nextOnAll2(e) {
	    	notificationCenter.send('next_light_state');
	    }
	</script>
</between-page>