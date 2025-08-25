// Notification Service for System-Level Notifications

(function() {
  // Check if browser supports notifications
  const notificationsSupported = 'Notification' in window;
  
  // Request permission for notifications
  function requestNotificationPermission() {
    if (!notificationsSupported) {
      console.warn('Notifications not supported in this browser');
      return Promise.resolve(false);
    }
    
    // Check if permission is already granted
    if (Notification.permission === 'granted') {
      return Promise.resolve(true);
    }
    
    // Request permission
    return Notification.requestPermission()
      .then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
          return true;
        } else {
          console.log('Notification permission denied');
          return false;
        }
      })
      .catch(error => {
        console.error('Error requesting notification permission:', error);
        return false;
      });
  }
  
  // Show a system notification
  function showSystemNotification(title, options = {}) {
    if (!notificationsSupported) {
      console.warn('Notifications not supported in this browser');
      return;
    }
    
    // Check if permission is granted
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }
    
    // Create notification
    const notification = new Notification(title, {
      body: options.body || '',
      icon: options.icon || 'favicon.ico',
      ...options
    });
    
    // Add click handler if provided
    if (options.onclick) {
      notification.onclick = options.onclick;
    }
    
    // Auto-close after 5 seconds if not persistent
    if (options.persistent !== true) {
      setTimeout(() => {
        notification.close();
      }, options.timeout || 5000);
    }
    
    return notification;
  }
  
  // User Notification Service
  const UserNotificationService = {
    // Poll for user notifications (rider assigned to their booking)
    pollUserNotifications: function(SCRIPT_URL, sessionId, lastCheckTime) {
      if (!SCRIPT_URL || !sessionId) return Promise.resolve([]);
      
      const url = `${SCRIPT_URL}?action=get_notifications&sessionId=${encodeURIComponent(sessionId)}&ts=${Date.now()}`;
      
      return fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.success && Array.isArray(data.notifications)) {
            // Filter for new notifications since last check
            return data.notifications.filter(notification => {
              const notificationTime = new Date(notification.created_at).getTime();
              return notificationTime > lastCheckTime;
            });
          }
          return [];
        })
        .catch(error => {
          console.error('Error fetching user notifications:', error);
          return [];
        });
    },
    
    // Show user notifications
    showUserNotifications: function(notifications) {
      notifications.forEach(notification => {
        let title = 'Booking Update';
        let body = notification.message;
        
        switch (notification.type) {
          case 'rider_assigned':
            title = 'Rider Assigned';
            break;
          case 'order_completed':
            title = 'Order Completed';
            break;
          case 'booking_created':
            title = 'Booking Confirmed';
            break;
          case 'new_message':
            title = 'New Message from Rider';
            break;
        }
        
        showSystemNotification(title, {
          body: body,
          icon: 'favicon.ico'
        });
      });
    }
  };
  
  // Rider Notification Service
  const RiderNotificationService = {
    // Poll for new bookings available for riders
    pollRiderNotifications: function(SCRIPT_URL, lastCheckTime) {
      if (!SCRIPT_URL) return Promise.resolve([]);
      
      const url = `${SCRIPT_URL}?action=get_all_bookings&type=all&ts=${Date.now()}`;
      
      return fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.success && Array.isArray(data.bookings)) {
            // Filter for new pending bookings since last check
            return data.bookings.filter(booking => {
              const bookingTime = new Date(booking.created_at).getTime();
              return (booking.status === 'pending' || (booking.status === 'assigned' && !booking.picked_up_at)) && bookingTime > lastCheckTime;
            });
          }
          return [];
        })
        .catch(error => {
          console.error('Error fetching rider notifications:', error);
          return [];
        });
    },
    
    // Show rider notifications
    showRiderNotifications: function(bookings) {
      bookings.forEach(booking => {
        const title = 'New Booking Available';
        const body = `New ${booking.booking_type} booking available: ${booking.order_id}`;
        
        showSystemNotification(title, {
          body: body,
          icon: 'favicon.ico',
          onclick: function() {
            // Focus the window and optionally navigate to rider dashboard
            window.focus();
          }
        });
      });
    }
  };
  
  // Initialize notification service
  function initNotificationService() {
    requestNotificationPermission()
      .then(granted => {
        if (granted) {
          console.log('System notifications are ready');
        } else {
          console.log('System notifications not available');
        }
      });
  }
  
  // Expose services globally
  window.UserNotificationService = UserNotificationService;
  window.RiderNotificationService = RiderNotificationService;
  window.showSystemNotification = showSystemNotification;
  window.initNotificationService = initNotificationService;
  
  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationService);
  } else {
    initNotificationService();
  }
})();