var notificationCenter = {
  notifications: riot.observable(),
  listenTo: function (eventStr, eventFn) {
    this.notifications.on(eventStr, eventFn);
  },
  send: function(eventStr, p1, p2, p3) {
    this.notifications.trigger(eventStr, p1, p2, p3);
  }
};

// register the notificationCenter throughout the app
riot.mixin("notificationcenter", notificationCenter);
