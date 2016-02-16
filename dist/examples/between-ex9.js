nextLight2(e) {
	var lightId = e.target.attributes['light-id'].value;
	notificationCenter.send('next_light_state', lightId);
}