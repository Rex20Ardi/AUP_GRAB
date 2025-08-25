# Notification System Design

## Overview
This document outlines the design and implementation of a notification system for the AUP Grab website. The system will provide visual feedback to users across all pages.

## CSS Styles

```css
/* Notification System Styles */

/* Notification container */
.notification-container {
  position: fixed;
  z-index: 9999;
  padding: 15px;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
}

/* Positioning classes */
.notification-container.top-right {
  top: 20px;
  right: 20px;
}

.notification-container.bottom-right {
  bottom: 20px;
  right: 20px;
}

.notification-container.center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Notification item */
.notification {
  position: relative;
  margin-bottom: 15px;
  padding: 15px;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out, fadeOut 0.5s ease-out 4.5s forwards;
  display: flex;
  align-items: flex-start;
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.notification:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

/* Notification types */
.notification.success {
  border-left: 4px solid #4caf50;
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
}

.notification.error {
  border-left: 4px solid #f44336;
  background: linear-gradient(135deg, #ffebee, #ffcdd2);
}

.notification.warning {
  border-left: 4px solid #ff9800;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
}

.notification.info {
  border-left: 4px solid #2196f3;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
}

/* Notification content */
.notification-content {
  flex: 1;
  padding-right: 20px;
}

.notification-title {
  font-weight: 600;
  margin: 0 0 5px 0;
  font-size: 1.1em;
}

.notification-message {
  margin: 0;
  font-size: 0.95em;
  color: #333;
}

/* Close button */
.notification-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.notification-close:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

/* Icons for notification types */
.notification-icon {
  margin-right: 12px;
  font-size: 20px;
}

.notification.success .notification-icon {
  color: #4caf50;
}

.notification.error .notification-icon {
  color: #f44336;
}

.notification.warning .notification-icon {
  color: #ff9800;
}

.notification.info .notification-icon {
  color: #2196f3;
}

/* Animations */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .notification-container {
    padding: 10px;
    max-width: none;
    left: 10px;
    right: 10px;
    width: auto;
  }
  
  .notification-container.top-right,
  .notification-container.bottom-right {
    right: 10px;
    left: 10px;
    width: auto;
  }
  
  .notification-container.center {
    left: 10px;
    right: 10px;
    width: auto;
    transform: translate(0, -50%);
  }
}
```

## JavaScript Functionality

```javascript
// Notification System JavaScript

(function() {
  // Create notification container if it doesn't exist
  function createNotificationContainer(position = 'top-right') {
    let container = document.getElementById(`notification-container-${position}`);
    if (!container) {
      container = document.createElement('div');
      container.id = `notification-container-${position}`;
      container.className = `notification-container ${position}`;
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
      position: 'top-right', // top-right, bottom-right, center
      duration: 5000, // milliseconds, 0 for no auto-dismiss
      closable: true
    };

    // Merge options with defaults
    const config = { ...defaults, ...options };

    // Create notification container
    const container = createNotificationContainer(config.position);

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${config.type}`;
    
    // Prevent auto-dismiss animation if duration is 0
    if (config.duration === 0) {
      notification.style.animation = 'slideIn 0.3s ease-out';
    }

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
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        ${config.title ? `<div class="notification-title">${config.title}</div>` : ''}
        <div class="notification-message">${config.message}</div>
      </div>
      ${config.closable ? '<button class="notification-close">&times;</button>' : ''}
    `;

    // Add to container
    container.appendChild(notification);

    // Add close functionality
    if (config.closable) {
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => {
        hideNotification(notification);
      });
    }

    // Auto-dismiss after duration
    if (config.duration > 0) {
      setTimeout(() => {
        hideNotification(notification);
      }, config.duration);
    }

    return notification;
  }

  // Hide notification function
  function hideNotification(notification) {
    notification.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
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
//   position: 'top-right',
//   duration: 5000
// });
```

## Implementation Plan

1. Create `notifications.css` with the CSS styles above
2. Create `notifications.js` with the JavaScript functionality above
3. Add links to these files in all HTML pages:
   ```html
   <link rel="stylesheet" href="notifications.css">
   <script src="notifications.js"></script>
   ```
4. Use the notification system throughout the application:
   ```javascript
   // Success notification
   showNotification({
     title: 'Booking Confirmed',
     message: 'Your booking has been successfully submitted.',
     type: 'success'
   });

   // Error notification
   showNotification({
     title: 'Error',
     message: 'Please fill in all required fields.',
     type: 'error'
   });
   ```

## Notification Types

1. **Success**: Green-themed notifications for successful actions
2. **Error**: Red-themed notifications for errors or failures
3. **Warning**: Orange-themed notifications for warnings or cautions
4. **Info**: Blue-themed notifications for informational messages

## Position Options

1. **top-right**: Default position in the top right corner
2. **bottom-right**: Position in the bottom right corner
3. **center**: Centered on the screen

## Customization Options

- **Title**: Optional title for the notification
- **Message**: Main content of the notification
- **Type**: success, error, warning, or info
- **Position**: top-right, bottom-right, or center
- **Duration**: Time in milliseconds before auto-dismiss (0 for no auto-dismiss)
- **Closable**: Whether the notification can be manually closed