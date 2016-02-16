// event handler for 'NEXT' link in Mechanism 1
nextLight1(e) {
	// get ID of traffic light from tag attribute (see Clicking at left)
	var lightId = e.target.attributes['light-id'].value;

	// find the traffic-light-direct tag with the correct ID
	var targetTraffic = thisTag.tags['traffic-light-direct'].filter(function(r) {
		 return r.opts.id == lightId;}
	)[0];

	if (targetTraffic) {
		// call the next() method directly on it
		targetTraffic.next();
	}
}
