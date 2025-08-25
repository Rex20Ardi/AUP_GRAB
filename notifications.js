// Notification System JavaScript

(function() {
  // Create notification container if it doesn't exist
  function createNotificationContainer() {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }
    return container;
  }

  // Show notification function
  function showNotification(options) {
    // Default options
    const defaults = {
      title: '',
      message: '',
      type: 'info', // success, error, warning, info
      duration: 5000, // milliseconds, 0 for no auto-dismiss
      closable: true
    };

    // Merge options with defaults
    const config = { ...defaults, ...options };

    // Create notification container
    const container = createNotificationContainer();

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-toast ${config.type}`;

    // Create icon based on type
    let icon = '';
    switch (config.type) {
      case 'success':
        icon = '✓';
        break;
      case 'error':
        icon = '✗';
        break;
      case 'warning':
        icon = '⚠';
        break;
      case 'info':
        icon = 'ℹ';
        break;
      default:
        icon = 'ℹ';
    }

    // Create notification content
    notification.innerHTML = `
      <div class="notification-icon ${config.type}">${icon}</div>
      <div class="notification-content">
        ${config.title ? `<div class="notification-title">${config.title}</div>` : ''}
        <div class="notification-message">${config.message}</div>
      </div>
      ${config.closable ? '<button class="notification-close">&times;</button>' : ''}
    `;

    // Add to container
    container.appendChild(notification);

    // Trigger reflow to enable transition
    notification.offsetHeight;

    // Show notification
    notification.classList.add('show');

    // Add close functionality
    if (config.closable) {
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => {
        hideNotification(notification);
      });
    }

    // Auto-dismiss after duration
    let timeoutId;
    if (config.duration > 0) {
      timeoutId = setTimeout(() => {
        hideNotification(notification);
      }, config.duration);
    }

    // Pause timeout on hover
    notification.addEventListener('mouseenter', () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });

    notification.addEventListener('mouseleave', () => {
      if (config.duration > 0) {
        timeoutId = setTimeout(() => {
          hideNotification(notification);
        }, config.duration);
      }
    });

    return notification;
  }

  // Hide notification function
  function hideNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  // Expose globally
  window.showNotification = showNotification;
  window.hideNotification = hideNotification;
})();

// Example usage:
// showNotification({
//   title: 'Success!',
//   message: 'Your booking has been confirmed.',
//   type: 'success',
//   duration: 5000
// });