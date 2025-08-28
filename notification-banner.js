document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('notification-banner');
    const yesBtn = document.getElementById('notify-yes');
    const noBtn = document.getElementById('notify-no');

    // Check if notifications are supported and permission has not been granted or denied
    if ('Notification' in window && Notification.permission === 'default') {
        banner.style.display = 'block';
    }

    yesBtn.addEventListener('click', () => {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('Notifications enabled!', {
                    body: 'You will now receive booking updates.'
                });
            }
            banner.style.display = 'none';
        });
    });

    noBtn.addEventListener('click', () => {
        banner.style.display = 'none';
    });
});