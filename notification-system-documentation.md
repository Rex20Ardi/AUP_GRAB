# Notification System Documentation

## Overview
The AUP Grab website now includes a consistent notification system across all pages (index.html, food.html, parcel.html, laundry.html, and rider.html). This system provides visual feedback to users for various actions and events.

## Implementation Details

### CSS Classes
The notification system uses the following CSS classes:
- `.notification` - Base styling for all notifications
- `.notification.success` - Styling for success messages (green)
- `.notification.error` - Styling for error messages (red)
- `.notification.show` - Active state that makes the notification visible

### JavaScript Function
All pages now include a `showNotification(message, type)` function:
- `message` (string): The text to display in the notification
- `type` (string): Either 'success' (default) or 'error'

### HTML Structure
Each page includes a notification container:
```html
<div class="notification" id="notification"></div>
```

## Usage Examples

### Success Notification
```javascript
showNotification('Order placed successfully!');
```

### Error Notification
```javascript
showNotification('Failed to place order. Please try again.', 'error');
```

## Consistency Across Pages

All pages now use the same notification system with:
- Consistent styling (green for success, red for errors)
- Same positioning (top-right corner)
- Same animation (slide-in from right)
- Same auto-dismiss behavior (3 seconds)

## Technical Notes

1. The notification system is self-contained and doesn't require external dependencies
2. Notifications automatically disappear after 3 seconds
3. The z-index is set to ensure notifications appear above other content
4. The system is responsive and works on mobile devices

## Integration with Existing Code

The notification system integrates seamlessly with existing functionality:
- Form submissions
- Order processing
- Error handling
- User feedback

Simply call `showNotification(message, type)` anywhere in your JavaScript code to display a notification to the user.