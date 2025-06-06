// PushNotificationSystem.jsx - Real-time push notification system
import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PushNotificationSystem.css';

/**
 * OrphiChain Push Notification System
 * 
 * Features:
 * - Real-time transaction notifications
 * - Error and success state feedback
 * - Queue management for multiple notifications
 * - Auto-dismiss with manual control
 * - Mobile-responsive design
 * - Accessibility support
 * - Priority-based display system
 */

const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  TRANSACTION: 'transaction'
};

const NOTIFICATION_PRIORITIES = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const PushNotificationSystem = ({ 
  maxNotifications = 5,
  defaultDuration = 6000,
  enableSound = true,
  position = 'top-right' // top-right, top-left, bottom-right, bottom-left
}) => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(true);
  const notificationId = useRef(0);
  const audioRef = useRef(null);

  // Initialize audio for notification sounds
  useEffect(() => {
    if (enableSound) {
      audioRef.current = new Audio('/sounds/notification.mp3');
      audioRef.current.volume = 0.3;
    }
  }, [enableSound]);

  // Auto-remove expired notifications
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => 
        prev.filter(notification => 
          !notification.autoRemove || 
          Date.now() - notification.timestamp < notification.duration
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Add new notification
  const addNotification = useCallback((notification) => {
    const id = ++notificationId.current;
    const timestamp = Date.now();
    
    const newNotification = {
      id,
      timestamp,
      type: NOTIFICATION_TYPES.INFO,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      title: '',
      message: '',
      duration: defaultDuration,
      autoRemove: true,
      actionButton: null,
      metadata: {},
      ...notification
    };

    setNotifications(prev => {
      // Remove oldest if at max capacity
      let updatedNotifications = prev;
      if (prev.length >= maxNotifications) {
        updatedNotifications = prev.slice(1);
      }

      // Add new notification and sort by priority
      const withNew = [...updatedNotifications, newNotification];
      return withNew.sort((a, b) => b.priority - a.priority);
    });

    // Play notification sound
    if (enableSound && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }

    return id;
  }, [defaultDuration, maxNotifications, enableSound]);

  // Remove specific notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Pre-built notification creators
  const showSuccess = useCallback((title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.SUCCESS,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      ...options
    });
  }, [addNotification]);

  const showError = useCallback((title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.ERROR,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      autoRemove: false, // Errors should be manually dismissed
      ...options
    });
  }, [addNotification]);

  const showWarning = useCallback((title, message, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.WARNING,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.MEDIUM,
      duration: 8000, // Warnings stay longer
      ...options
    });
  }, [addNotification]);

  const showTransaction = useCallback((title, message, txHash, options = {}) => {
    return addNotification({
      type: NOTIFICATION_TYPES.TRANSACTION,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      autoRemove: false,
      actionButton: txHash ? {
        label: 'View Transaction',
        action: () => window.open(`https://polygonscan.com/tx/${txHash}`, '_blank')
      } : null,
      metadata: { txHash },
      ...options
    });
  }, [addNotification]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'h': // Hide/show notifications
            e.preventDefault();
            setIsVisible(prev => !prev);
            break;
          case 'Delete': // Clear all
            e.preventDefault();
            clearAll();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [clearAll]);

  // Expose methods globally for easy access
  useEffect(() => {
    window.OrphiNotifications = {
      show: addNotification,
      success: showSuccess,
      error: showError,
      warning: showWarning,
      transaction: showTransaction,
      remove: removeNotification,
      clear: clearAll,
      toggle: () => setIsVisible(prev => !prev)
    };

    return () => {
      delete window.OrphiNotifications;
    };
  }, [addNotification, showSuccess, showError, showWarning, showTransaction, removeNotification, clearAll]);

  if (!isVisible || notifications.length === 0) {
    return null;
  }

  return (
    <div className={`orphi-notifications-container ${position}`} role="region" aria-label="Notifications">
      <div className="notifications-header">
        <span className="notifications-count">{notifications.length}</span>
        <button 
          className="notifications-toggle"
          onClick={() => setIsVisible(false)}
          aria-label="Hide notifications"
        >
          ✕
        </button>
      </div>

      <div className="notifications-list">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRemove={removeNotification}
          />
        ))}
      </div>

      {notifications.length > 2 && (
        <div className="notifications-footer">
          <button 
            className="clear-all-btn"
            onClick={clearAll}
            aria-label="Clear all notifications"
          >
            Clear All ({notifications.length})
          </button>
        </div>
      )}
    </div>
  );
};

// Individual notification component
const NotificationItem = ({ notification, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(100);
  const timeoutRef = useRef(null);

  // Progress bar animation for auto-remove notifications
  useEffect(() => {
    if (notification.autoRemove && notification.duration > 0) {
      const startTime = Date.now();
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, notification.duration - elapsed);
        const progressPercent = (remaining / notification.duration) * 100;
        
        setProgress(progressPercent);
        
        if (remaining > 0) {
          timeoutRef.current = requestAnimationFrame(updateProgress);
        }
      };
      
      updateProgress();
      
      return () => {
        if (timeoutRef.current) {
          cancelAnimationFrame(timeoutRef.current);
        }
      };
    }
  }, [notification.autoRemove, notification.duration]);

  const getIcon = () => {
    switch (notification.type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return '✅';
      case NOTIFICATION_TYPES.ERROR:
        return '❌';
      case NOTIFICATION_TYPES.WARNING:
        return '⚠️';
      case NOTIFICATION_TYPES.TRANSACTION:
        return '🔄';
      default:
        return 'ℹ️';
    }
  };

  const handleActionClick = () => {
    if (notification.actionButton?.action) {
      notification.actionButton.action();
    }
  };

  return (
    <div 
      className={`orphi-notification ${notification.type} ${notification.priority === NOTIFICATION_PRIORITIES.HIGH ? 'high-priority' : ''}`}
      role="alert"
      aria-live={notification.type === NOTIFICATION_TYPES.ERROR ? 'assertive' : 'polite'}
    >
      {notification.autoRemove && (
        <div 
          className="notification-progress"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="notification-content">
        <div className="notification-header">
          <span className="notification-icon" role="img" aria-label={notification.type}>
            {getIcon()}
          </span>
          <span className="notification-title">{notification.title}</span>
          <button 
            className="notification-close"
            onClick={() => onRemove(notification.id)}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>

        <div className="notification-body">
          <p className="notification-message">{notification.message}</p>
          
          {notification.metadata?.txHash && (
            <div className="notification-metadata">
              <span className="tx-hash">
                Tx: {notification.metadata.txHash.slice(0, 10)}...
              </span>
            </div>
          )}

          {notification.actionButton && (
            <button 
              className="notification-action"
              onClick={handleActionClick}
            >
              {notification.actionButton.label}
            </button>
          )}
        </div>
      </div>

      <div className="notification-timestamp">
        {new Date(notification.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PushNotificationSystem;
export { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES };
