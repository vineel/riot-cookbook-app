nextOnAll(e) {
	// loop through each traffic-light-direct tag instance
	thisTag.tags['traffic-light-direct'].forEach(function(light) {
		// call next method directly on each tag instance
		light.next();
	})
}